//! Hybrid PQC bindings for AttestPQC.
//!
//! - **KEM identity**: X25519 + ML-KEM-768 per
//!   [draft-westerbaan-cfrg-hpke-xyber768d00](https://bwesterb.github.io/draft-westerbaan-cfrg-hpke-xyber768d00/draft-westerbaan-cfrg-hpke-xyber768d00.html)
//!   (`Algorithm::X25519MlKem768Draft00` in libcrux-kem).
//! - **Signing**: hybrid P-256 ECDSA (SHA-256) + ML-DSA-65 (FIPS 204).

use core::convert::AsRef;
use libcrux_ecdh::{p256_secret_to_public, P256PrivateKey};
use libcrux_ecdsa::p256::{self, PrivateKey as EcdsaPrivateKey, PublicKey as EcdsaPublicKey};
use libcrux_ecdsa::DigestAlgorithm;
use libcrux_kem::{key_gen, Algorithm};
use libcrux_ml_dsa::ml_dsa_65::portable as ml_dsa_65;
use libcrux_ml_dsa::ml_dsa_65::{
    MLDSA65Signature, MLDSA65SigningKey, MLDSA65VerificationKey,
};
use libcrux_ml_dsa::{KEY_GENERATION_RANDOMNESS_SIZE, SIGNING_RANDOMNESS_SIZE};
use rand::RngExt;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

/// Domain-separation context for ML-DSA attestation signatures.
const ATTESTATION_MLDSA_CONTEXT: &[u8] = b"AttestPQC/v1";

const MLDSA65_SK_LEN: usize = 4032;
const MLDSA65_VK_LEN: usize = 1952;
const MLDSA65_SIG_LEN: usize = 3309;

/// Serialized hybrid identity (private material — store only in browser local storage).
#[derive(Clone, Serialize, Deserialize)]
pub struct HybridIdentityMaterial {
    pub kem_private_key: Vec<u8>,
    pub kem_public_key: Vec<u8>,
    pub ecdsa_private_key: Vec<u8>,
    pub ecdsa_public_key: Vec<u8>,
    pub mldsa_signing_key: Vec<u8>,
    pub mldsa_verification_key: Vec<u8>,
}

fn fill_random<const N: usize>(buf: &mut [u8; N]) {
    rand::rng().fill(buf);
}

fn bytes_to_array<const N: usize>(bytes: &[u8], label: &str) -> Result<[u8; N], String> {
    bytes
        .try_into()
        .map_err(|_| format!("{label}: expected {N} bytes, got {}", bytes.len()))
}

/// Generate a full hybrid identity: X25519MlKem768Draft00 KEM + P-256 ECDSA + ML-DSA-65 signing keys.
pub fn generate_hybrid_identity_inner() -> Result<HybridIdentityMaterial, String> {
    let mut rng = rand::rng();

    let (kem_sk, kem_pk) =
        key_gen(Algorithm::X25519MlKem768Draft00, &mut rng).map_err(|e| format!("KEM keygen: {e:?}"))?;

    let ecdsa_sk = EcdsaPrivateKey::random(&mut rng).map_err(|e| format!("ECDSA keygen: {e:?}"))?;
    let p256_sk = P256PrivateKey(*ecdsa_sk.as_ref());
    let ecdsa_pk_coords = p256_secret_to_public(&p256_sk)
        .map_err(|e| format!("ECDSA pubkey derive: {e:?}"))?;
    let ecdsa_pk =
        EcdsaPublicKey::try_from(AsRef::<[u8; 64]>::as_ref(&ecdsa_pk_coords) as &[u8])
            .map_err(|e| format!("ECDSA pubkey validate: {e:?}"))?;

    let mut mldsa_seed = [0u8; KEY_GENERATION_RANDOMNESS_SIZE];
    fill_random(&mut mldsa_seed);
    let mldsa_kp = ml_dsa_65::generate_key_pair(mldsa_seed);

    Ok(HybridIdentityMaterial {
        kem_private_key: kem_sk.encode(),
        kem_public_key: kem_pk.encode(),
        ecdsa_private_key: AsRef::<[u8; 32]>::as_ref(&ecdsa_sk).to_vec(),
        ecdsa_public_key: AsRef::<[u8; 64]>::as_ref(&ecdsa_pk).to_vec(),
        mldsa_signing_key: mldsa_kp.signing_key.as_ref().to_vec(),
        mldsa_verification_key: mldsa_kp.verification_key.as_ref().to_vec(),
    })
}

/// Concatenate hybrid public keys: KEM (1216 B) || ECDSA (64 B) || ML-DSA-65 VK (1952 B).
pub fn hybrid_public_key_bytes(material: &HybridIdentityMaterial) -> Vec<u8> {
    let mut out = Vec::with_capacity(
        material.kem_public_key.len()
            + material.ecdsa_public_key.len()
            + material.mldsa_verification_key.len(),
    );
    out.extend_from_slice(&material.kem_public_key);
    out.extend_from_slice(&material.ecdsa_public_key);
    out.extend_from_slice(&material.mldsa_verification_key);
    out
}

/// Sign a message with hybrid P-256 ECDSA + ML-DSA-65.
/// Returns `ecdsa_signature (64 B) || mldsa_signature (3309 B)`.
pub fn sign_hybrid_inner(material: &HybridIdentityMaterial, message: &[u8]) -> Result<Vec<u8>, String> {
    let mut rng = rand::rng();

    let ecdsa_sk = EcdsaPrivateKey::try_from(material.ecdsa_private_key.as_slice())
        .map_err(|e| format!("ECDSA sk decode: {e:?}"))?;
    let ecdsa_sig = p256::rand::sign(DigestAlgorithm::Sha256, message, &ecdsa_sk, &mut rng)
        .map_err(|e| format!("ECDSA sign: {e:?}"))?;
    let (r, s) = ecdsa_sig.as_bytes();
    let mut ecdsa_bytes = [0u8; 64];
    ecdsa_bytes[..32].copy_from_slice(r);
    ecdsa_bytes[32..].copy_from_slice(s);

    let sk_arr = bytes_to_array::<MLDSA65_SK_LEN>(&material.mldsa_signing_key, "ML-DSA signing key")?;
    let mldsa_sk = MLDSA65SigningKey::new(sk_arr);

    let mut mldsa_rand = [0u8; SIGNING_RANDOMNESS_SIZE];
    fill_random(&mut mldsa_rand);
    let mldsa_sig = ml_dsa_65::sign(
        &mldsa_sk,
        message,
        ATTESTATION_MLDSA_CONTEXT,
        mldsa_rand,
    )
    .map_err(|e| format!("ML-DSA sign: {e:?}"))?;

    let mut out = Vec::with_capacity(64 + MLDSA65_SIG_LEN);
    out.extend_from_slice(&ecdsa_bytes);
    out.extend_from_slice(mldsa_sig.as_ref());
    Ok(out)
}

/// Verify a hybrid signature (for local self-checks in the browser).
pub fn verify_hybrid_inner(
    material: &HybridIdentityMaterial,
    message: &[u8],
    signature: &[u8],
) -> Result<(), String> {
    if signature.len() < 64 {
        return Err("signature too short for ECDSA component".into());
    }
    let (ecdsa_part, mldsa_part) = signature.split_at(64);

    let ecdsa_pk = EcdsaPublicKey::try_from(material.ecdsa_public_key.as_slice())
        .map_err(|e| format!("ECDSA pk decode: {e:?}"))?;
    let mut r = [0u8; 32];
    let mut s = [0u8; 32];
    r.copy_from_slice(&ecdsa_part[..32]);
    s.copy_from_slice(&ecdsa_part[32..]);
    let ecdsa_sig = p256::Signature::from_raw(r, s);
    p256::verify(DigestAlgorithm::Sha256, message, &ecdsa_sig, &ecdsa_pk)
        .map_err(|e| format!("ECDSA verify: {e:?}"))?;

    let vk_arr =
        bytes_to_array::<MLDSA65_VK_LEN>(&material.mldsa_verification_key, "ML-DSA verification key")?;
    let mldsa_vk = MLDSA65VerificationKey::new(vk_arr);
    let sig_arr = bytes_to_array::<MLDSA65_SIG_LEN>(mldsa_part, "ML-DSA signature")?;
    let mldsa_sig = MLDSA65Signature::new(sig_arr);
    ml_dsa_65::verify(&mldsa_vk, message, ATTESTATION_MLDSA_CONTEXT, &mldsa_sig)
        .map_err(|e| format!("ML-DSA verify: {e:?}"))?;

    Ok(())
}

#[wasm_bindgen]
pub fn generate_hybrid_identity_json() -> Result<String, JsValue> {
    let material = generate_hybrid_identity_inner().map_err(|e| JsValue::from_str(&e))?;
    serde_json::to_string(&material).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen]
pub fn hybrid_public_key_json(identity_json: &str) -> Result<String, JsValue> {
    let material: HybridIdentityMaterial =
        serde_json::from_str(identity_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let bytes = hybrid_public_key_bytes(&material);
    serde_json::to_string(&bytes).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen]
pub fn sign_hybrid_json(identity_json: &str, message: &[u8]) -> Result<String, JsValue> {
    let material: HybridIdentityMaterial =
        serde_json::from_str(identity_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let sig = sign_hybrid_inner(&material, message).map_err(|e| JsValue::from_str(&e))?;
    serde_json::to_string(&sig).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen]
pub fn verify_hybrid_json(
    identity_json: &str,
    message: &[u8],
    signature_json: &str,
) -> Result<bool, JsValue> {
    let material: HybridIdentityMaterial =
        serde_json::from_str(identity_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let signature: Vec<u8> =
        serde_json::from_str(signature_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
    verify_hybrid_inner(&material, message, &signature)
        .map(|_| true)
        .map_err(|e| JsValue::from_str(&e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_hybrid_sign_verify() {
        let material = generate_hybrid_identity_inner().expect("keygen");
        let msg = b"attestpqc/v1|subject:0xabc|content:0xdef";
        let sig = sign_hybrid_inner(&material, msg).expect("sign");
        verify_hybrid_inner(&material, msg, &sig).expect("verify");
        assert_eq!(material.kem_public_key.len(), 1216);
    }
}
//! Winterfell STARK WASM bindings for AttestPQC attestation binding proofs.

mod attestation_air;

use attestation_air::{
    bytes32_to_field, field_to_u128, proof_from_bytes, proof_to_bytes, prove_attestation_binding,
    random_blinding, verify_attestation_binding, AttestationPublicInputs,
};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use winterfell::math::fields::f128::BaseElement;

#[derive(Serialize, Deserialize)]
struct ProveRequest {
    subject: String,
    content_hash: String,
    attestation_id: String,
    blinding: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct PublicInputsJson {
    subject: String,
    content_hash: String,
    attestation_id: String,
    commitment: String,
}

#[derive(Serialize, Deserialize)]
struct ProveResponse {
    proof_bytes: Vec<u8>,
    public_inputs: PublicInputsJson,
}

#[derive(Serialize, Deserialize)]
struct VerifyRequest {
    proof_bytes: Vec<u8>,
    public_inputs: PublicInputsJson,
}

fn parse_hex32(label: &str, hex: &str) -> Result<[u8; 32], String> {
    let stripped = hex.strip_prefix("0x").unwrap_or(hex);
    if stripped.len() != 64 {
        return Err(format!("{label}: expected 32-byte hex, got {} chars", stripped.len()));
    }
    let mut out = [0u8; 32];
    for i in 0..32 {
        let byte = u8::from_str_radix(&stripped[i * 2..i * 2 + 2], 16)
            .map_err(|e| format!("{label}: invalid hex: {e}"))?;
        out[i] = byte;
    }
    Ok(out)
}

fn parse_u128(label: &str, value: &str) -> Result<u128, String> {
    let stripped = value.strip_prefix("0x").unwrap_or(value);
    if stripped.len() <= 16 && stripped.chars().all(|c| c.is_ascii_digit()) {
        return stripped
            .parse::<u128>()
            .map_err(|e| format!("{label}: {e}"));
    }
    u128::from_str_radix(stripped, 16).map_err(|e| format!("{label}: {e}"))
}

fn pub_inputs_from_json(json: &PublicInputsJson) -> Result<AttestationPublicInputs, String> {
    let subject = bytes32_to_field(&parse_hex32("subject", &json.subject)?);
    let content_hash = bytes32_to_field(&parse_hex32("content_hash", &json.content_hash)?);
    let attestation_id = BaseElement::new(parse_u128("attestation_id", &json.attestation_id)?);
    let commitment = field_from_hex("commitment", &json.commitment)?;
    Ok(AttestationPublicInputs {
        subject,
        content_hash,
        attestation_id,
        commitment,
    })
}

fn pub_inputs_to_json(inputs: &AttestationPublicInputs) -> PublicInputsJson {
    PublicInputsJson {
        subject: field_bytes32_hex(inputs.subject),
        content_hash: field_bytes32_hex(inputs.content_hash),
        attestation_id: field_to_u128(inputs.attestation_id).to_string(),
        commitment: field_element_hex(inputs.commitment),
    }
}

fn field_bytes32_hex(value: BaseElement) -> String {
    let limb = field_to_u128(value);
    format!("0x{:0>64x}", limb)
}

fn field_element_hex(value: BaseElement) -> String {
    format!("0x{:x}", field_to_u128(value))
}

fn field_from_hex(label: &str, hex: &str) -> Result<BaseElement, String> {
    Ok(BaseElement::new(parse_u128(label, hex)?))
}

fn prove_inner(request: ProveRequest) -> Result<ProveResponse, String> {
    let subject = bytes32_to_field(&parse_hex32("subject", &request.subject)?);
    let content_hash = bytes32_to_field(&parse_hex32("content_hash", &request.content_hash)?);
    let attestation_id =
        BaseElement::new(parse_u128("attestation_id", &request.attestation_id)?);
    let blinding = match request.blinding.as_deref() {
        Some(hex) => bytes32_to_field(&parse_hex32("blinding", hex)?),
        None => random_blinding(),
    };

    let (proof, pub_inputs) = prove_attestation_binding(subject, content_hash, attestation_id, blinding)
        .map_err(|e| format!("prove: {e}"))?;

    Ok(ProveResponse {
        proof_bytes: proof_to_bytes(&proof),
        public_inputs: pub_inputs_to_json(&pub_inputs),
    })
}

#[wasm_bindgen]
pub fn prove_attestation_binding_json(request_json: &str) -> Result<String, JsValue> {
    let request: ProveRequest =
        serde_json::from_str(request_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let response = prove_inner(request).map_err(|e| JsValue::from_str(&e))?;
    serde_json::to_string(&response).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen]
pub fn verify_attestation_binding_json(request_json: &str) -> Result<bool, JsValue> {
    let request: VerifyRequest =
        serde_json::from_str(request_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let proof = proof_from_bytes(&request.proof_bytes).map_err(|e| JsValue::from_str(&e))?;
    let pub_inputs = pub_inputs_from_json(&request.public_inputs).map_err(|e| JsValue::from_str(&e))?;
    verify_attestation_binding(&proof, &pub_inputs)
        .map(|_| true)
        .map_err(|e| JsValue::from_str(&format!("verify: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn json_roundtrip() {
        let req = ProveRequest {
            subject: "0x000000000000000000000000000000000000000000000000000000000000002a".into(),
            content_hash: "0x00000000000000000000000000000000000000000000000000000000000003e9".into(),
            attestation_id: "1".into(),
            blinding: Some(
                "0x00000000000000000000000000000000000000000000000000000000000f423f".into(),
            ),
        };
        let response = prove_inner(req).unwrap();
        let verify_req = VerifyRequest {
            proof_bytes: response.proof_bytes,
            public_inputs: response.public_inputs,
        };
        let proof = proof_from_bytes(&verify_req.proof_bytes).unwrap();
        let pub_inputs = pub_inputs_from_json(&verify_req.public_inputs).unwrap();
        verify_attestation_binding(&proof, &pub_inputs).unwrap();
    }
}
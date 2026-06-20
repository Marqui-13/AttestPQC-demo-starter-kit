//! Attestation binding STARK: proves a private blinding factor binds on-chain
//! `subject` and `content_hash` to a public field commitment without revealing the witness.

use winterfell::{
    crypto::{hashers::Blake3_256, DefaultRandomCoin, MerkleTree},
    math::{fields::f128::BaseElement, FieldElement, StarkField, ToElements},
    matrix::ColMatrix,
    Air, AirContext, Assertion, AuxRandElements, BatchingMethod, CompositionPoly,
    CompositionPolyTrace, ConstraintCompositionCoefficients, DefaultConstraintCommitment,
    DefaultConstraintEvaluator, DefaultTraceLde, EvaluationFrame, FieldExtension,
    PartitionOptions, Proof, ProofOptions, Prover, ProverError, StarkDomain,
    Trace, TraceInfo, TracePolyTable, TraceTable, TransitionConstraintDegree,
};

pub const TRACE_LENGTH: usize = 64;
const TRACE_WIDTH: usize = 2;
const COL_STATE: usize = 0;
const COL_BLINDING: usize = 1;

#[derive(Clone, Debug)]
pub struct AttestationPublicInputs {
    pub subject: BaseElement,
    pub content_hash: BaseElement,
    pub attestation_id: BaseElement,
    pub commitment: BaseElement,
}

impl ToElements<BaseElement> for AttestationPublicInputs {
    fn to_elements(&self) -> Vec<BaseElement> {
        vec![
            self.subject,
            self.content_hash,
            self.attestation_id,
            self.commitment,
        ]
    }
}

pub struct AttestationBindingAir {
    context: AirContext<BaseElement>,
    subject: BaseElement,
    content_hash: BaseElement,
    attestation_id: BaseElement,
    commitment: BaseElement,
}

impl Air for AttestationBindingAir {
    type BaseField = BaseElement;
    type PublicInputs = AttestationPublicInputs;

    fn new(trace_info: TraceInfo, pub_inputs: AttestationPublicInputs, options: ProofOptions) -> Self {
        assert_eq!(TRACE_WIDTH, trace_info.width());

        let degrees = vec![
            TransitionConstraintDegree::new(3),
            TransitionConstraintDegree::new(1),
        ];
        let num_assertions = 2;

        AttestationBindingAir {
            context: AirContext::new(trace_info, degrees, num_assertions, options),
            subject: pub_inputs.subject,
            content_hash: pub_inputs.content_hash,
            attestation_id: pub_inputs.attestation_id,
            commitment: pub_inputs.commitment,
        }
    }

    fn evaluate_transition<E: FieldElement + From<Self::BaseField>>(
        &self,
        frame: &EvaluationFrame<E>,
        _periodic_values: &[E],
        result: &mut [E],
    ) {
        let current_state = frame.current()[COL_STATE];
        let next_state = current_state.exp(3u32.into())
            + frame.current()[COL_BLINDING]
            + E::from(self.content_hash)
            + E::from(self.attestation_id);

        result[0] = frame.next()[COL_STATE] - next_state;
        result[1] = frame.next()[COL_BLINDING] - frame.current()[COL_BLINDING];
    }

    fn get_assertions(&self) -> Vec<Assertion<Self::BaseField>> {
        let last_step = self.trace_length() - 1;
        vec![
            Assertion::single(COL_STATE, 0, self.subject),
            Assertion::single(COL_STATE, last_step, self.commitment),
        ]
    }

    fn context(&self) -> &AirContext<Self::BaseField> {
        &self.context
    }
}

pub fn advance_state(
    mut state: BaseElement,
    blinding: BaseElement,
    content_hash: BaseElement,
    attestation_id: BaseElement,
    steps: usize,
) -> BaseElement {
    for _ in 0..steps {
        state = state.exp(3u32.into()) + blinding + content_hash + attestation_id;
    }
    state
}

pub fn build_attestation_trace(
    subject: BaseElement,
    blinding: BaseElement,
    content_hash: BaseElement,
    attestation_id: BaseElement,
) -> TraceTable<BaseElement> {
    let mut trace = TraceTable::new(TRACE_WIDTH, TRACE_LENGTH);
    trace.fill(
        |state| {
            state[COL_STATE] = subject;
            state[COL_BLINDING] = blinding;
        },
        |_, state| {
            state[COL_STATE] = state[COL_STATE].exp(3u32.into())
                + state[COL_BLINDING]
                + content_hash
                + attestation_id;
        },
    );
    trace
}

struct AttestationProver {
    options: ProofOptions,
    content_hash: BaseElement,
    attestation_id: BaseElement,
}

impl AttestationProver {
    fn new(options: ProofOptions, content_hash: BaseElement, attestation_id: BaseElement) -> Self {
        Self {
            options,
            content_hash,
            attestation_id,
        }
    }
}

impl Prover for AttestationProver {
    type BaseField = BaseElement;
    type Air = AttestationBindingAir;
    type Trace = TraceTable<Self::BaseField>;
    type HashFn = Blake3_256<Self::BaseField>;
    type VC = MerkleTree<Self::HashFn>;
    type RandomCoin = DefaultRandomCoin<Self::HashFn>;
    type TraceLde<E: FieldElement<BaseField = Self::BaseField>> =
        DefaultTraceLde<E, Self::HashFn, Self::VC>;
    type ConstraintCommitment<E: FieldElement<BaseField = Self::BaseField>> =
        DefaultConstraintCommitment<E, Self::HashFn, Self::VC>;
    type ConstraintEvaluator<'a, E: FieldElement<BaseField = Self::BaseField>> =
        DefaultConstraintEvaluator<'a, Self::Air, E>;

    fn get_pub_inputs(&self, trace: &Self::Trace) -> AttestationPublicInputs {
        let last_step = trace.length() - 1;
        AttestationPublicInputs {
            subject: trace.get(COL_STATE, 0),
            content_hash: self.content_hash,
            attestation_id: self.attestation_id,
            commitment: trace.get(COL_STATE, last_step),
        }
    }

    fn options(&self) -> &ProofOptions {
        &self.options
    }

    fn new_trace_lde<E: FieldElement<BaseField = Self::BaseField>>(
        &self,
        trace_info: &TraceInfo,
        main_trace: &ColMatrix<Self::BaseField>,
        domain: &StarkDomain<Self::BaseField>,
        partition_option: PartitionOptions,
    ) -> (Self::TraceLde<E>, TracePolyTable<E>) {
        DefaultTraceLde::new(trace_info, main_trace, domain, partition_option)
    }

    fn build_constraint_commitment<E: FieldElement<BaseField = Self::BaseField>>(
        &self,
        composition_poly_trace: CompositionPolyTrace<E>,
        num_constraint_composition_columns: usize,
        domain: &StarkDomain<Self::BaseField>,
        partition_options: PartitionOptions,
    ) -> (Self::ConstraintCommitment<E>, CompositionPoly<E>) {
        DefaultConstraintCommitment::new(
            composition_poly_trace,
            num_constraint_composition_columns,
            domain,
            partition_options,
        )
    }

    fn new_evaluator<'a, E: FieldElement<BaseField = Self::BaseField>>(
        &self,
        air: &'a Self::Air,
        aux_rand_elements: Option<AuxRandElements<E>>,
        composition_coefficients: ConstraintCompositionCoefficients<E>,
    ) -> Self::ConstraintEvaluator<'a, E> {
        DefaultConstraintEvaluator::new(air, aux_rand_elements, composition_coefficients)
    }
}

pub fn proof_options() -> ProofOptions {
    ProofOptions::new(
        40,
        8,
        0,
        FieldExtension::None,
        8,
        31,
        BatchingMethod::Linear,
        BatchingMethod::Linear,
    )
}

pub fn prove_attestation_binding(
    subject: BaseElement,
    content_hash: BaseElement,
    attestation_id: BaseElement,
    blinding: BaseElement,
) -> Result<(Proof, AttestationPublicInputs), ProverError> {
    let trace = build_attestation_trace(subject, blinding, content_hash, attestation_id);
    let steps = TRACE_LENGTH - 1;
    let commitment = advance_state(subject, blinding, content_hash, attestation_id, steps);

    let pub_inputs = AttestationPublicInputs {
        subject,
        content_hash,
        attestation_id,
        commitment,
    };

    let prover = AttestationProver::new(proof_options(), content_hash, attestation_id);
    let proof = prover.prove(trace)?;
    Ok((proof, pub_inputs))
}

pub fn verify_attestation_binding(
    proof: &Proof,
    pub_inputs: &AttestationPublicInputs,
) -> Result<(), winterfell::VerifierError> {
    let min_opts = winterfell::AcceptableOptions::MinConjecturedSecurity(80);
    winterfell::verify::<
        AttestationBindingAir,
        Blake3_256<BaseElement>,
        DefaultRandomCoin<Blake3_256<BaseElement>>,
        MerkleTree<Blake3_256<BaseElement>>,
    >(proof.clone(), pub_inputs.clone(), &min_opts)
}

pub fn proof_to_bytes(proof: &Proof) -> Vec<u8> {
    proof.to_bytes()
}

pub fn proof_from_bytes(bytes: &[u8]) -> Result<Proof, String> {
    Proof::from_bytes(bytes).map_err(|e| format!("proof decode: {e}"))
}

pub fn field_to_u128(value: BaseElement) -> u128 {
    value.as_int()
}

pub fn bytes32_to_field(bytes: &[u8; 32]) -> BaseElement {
    let mut limb = [0u8; 16];
    limb.copy_from_slice(&bytes[16..32]);
    BaseElement::new(u128::from_be_bytes(limb))
}

pub fn random_blinding() -> BaseElement {
    let mut buf = [0u8; 16];
    getrandom::fill(&mut buf).expect("random");
    BaseElement::new(u128::from_le_bytes(buf))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prove_and_verify_roundtrip() {
        let subject = BaseElement::new(42);
        let content_hash = BaseElement::new(1001);
        let attestation_id = BaseElement::new(7);
        let blinding = BaseElement::new(999_999);

        let (proof, pub_inputs) =
            prove_attestation_binding(subject, content_hash, attestation_id, blinding).unwrap();
        verify_attestation_binding(&proof, &pub_inputs).unwrap();

        let bytes = proof_to_bytes(&proof);
        let decoded = proof_from_bytes(&bytes).unwrap();
        verify_attestation_binding(&decoded, &pub_inputs).unwrap();
    }
}
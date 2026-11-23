"""
lab_test/logic.py
Rule-based GeneXpert / lab-result interpreter for TB determination.

GeneXpert MTB/RIF is a molecular rapid test with very high specificity.
If the test detects MTB → TB is confirmed regardless of X-ray/blood findings.
"""


def predict_lab(
    genexpert_result: str,     # "positive" | "negative" | "indeterminate"
    rifampicin_resistance: str # "yes" | "no" | "indeterminate"
) -> dict:
    """
    Applies evidence-based rule logic to GeneXpert results.

    Parameters
    ----------
    genexpert_result       : result string (case-insensitive)
    rifampicin_resistance  : resistance flag  (case-insensitive)

    Returns
    -------
    dict with keys: tb_positive, confidence, rifampicin_resistant, message
    """
    gx  = genexpert_result.strip().lower()
    rif = rifampicin_resistance.strip().lower()

    # ── Rule 1: Confirmed TB ────────────────────────────────────────────────
    if gx == "positive":
        rifampicin_resistant = rif == "yes"

        if rifampicin_resistant:
            message = (
                "GeneXpert result is POSITIVE with Rifampicin resistance detected. "
                "This indicates possible MDR-TB (Multi-Drug Resistant Tuberculosis). "
                "Immediate referral to a specialist and DST (Drug Sensitivity Test) required."
            )
            confidence = 99.0
        else:
            message = (
                "GeneXpert result is POSITIVE with no Rifampicin resistance. "
                "Standard first-line DOTS therapy (HRZE regimen) is indicated. "
                "Initiate treatment under NTEP guidelines."
            )
            confidence = 99.0

        return {
            "tb_positive": True,
            "confidence": confidence,
            "rifampicin_resistant": rifampicin_resistant,
            "message": message,
        }

    # ── Rule 2: No TB detected ──────────────────────────────────────────────
    elif gx == "negative":
        return {
            "tb_positive": False,
            "confidence": 95.0,
            "rifampicin_resistant": False,
            "message": (
                "GeneXpert result is NEGATIVE — TB not detected by molecular test. "
                "If clinical suspicion remains high, consider sputum culture (LJ/MGIT) "
                "and chest X-ray correlation."
            ),
        }

    # ── Rule 3: Indeterminate / Error ───────────────────────────────────────
    else:
        return {
            "tb_positive": None,
            "confidence": 0.0,
            "rifampicin_resistant": None,
            "message": (
                "GeneXpert result is INDETERMINATE or could not be processed. "
                "Repeat the test with a fresh sputum sample. "
                "Consult a clinician for further evaluation."
            ),
        }

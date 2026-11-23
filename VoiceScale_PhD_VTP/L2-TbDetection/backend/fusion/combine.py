"""
fusion/combine.py
Fuses outputs from X-ray, blood-test, and lab modules into a single
final TB prediction using a weighted logistic regression strategy.

Weights reflect clinical evidence strength:
  - Lab (GeneXpert):  highest weight — near-definitive molecular test
  - X-ray:            second         — strong imaging evidence
  - Blood:            supporting     — non-specific but informative
"""

import numpy as np
from typing import Optional

# ── Weights ───────────────────────────────────────────────────────────────────
# When all three are present: lab=0.5, xray=0.3, blood=0.2
# Weights renormalize automatically for partial inputs.

_BASE_WEIGHTS = {
    "lab":   0.50,
    "xray":  0.30,
    "blood": 0.20,
}

# ── Risk classification ───────────────────────────────────────────────────────

def _risk_level(prob: float) -> str:
    if prob >= 0.80:
        return "HIGH"
    elif prob >= 0.50:
        return "MODERATE"
    elif prob >= 0.30:
        return "LOW"
    else:
        return "MINIMAL"


def _recommendation(risk: str, tb_positive: bool) -> str:
    recs = {
        "HIGH": (
            "Immediate medical evaluation required. "
            "Initiate diagnostic workup: sputum AFB smear, culture, and HRCT chest. "
            "Isolate patient if infectious TB is suspected. Notify NTEP."
        ),
        "MODERATE": (
            "Recommend clinical consultation within 48 hours. "
            "Order GeneXpert MTB/RIF and chest X-ray if not already done. "
            "Monitor symptoms closely."
        ),
        "LOW": (
            "Low TB probability but residual uncertainty. "
            "Follow-up in 2–4 weeks. Repeat blood work if symptoms persist."
        ),
        "MINIMAL": (
            "TB unlikely based on available data. "
            "Maintain general health screening schedule. "
            "Seek care if new respiratory symptoms develop."
        ),
    }
    return recs.get(risk, "Please consult a healthcare professional.")


# ── Public API ────────────────────────────────────────────────────────────────

def predict_final(
    xray_prob:   Optional[float] = None,
    blood_prob:  Optional[float] = None,
    lab_result:  Optional[bool]  = None,
) -> dict:
    """
    Parameters
    ----------
    xray_prob   : float [0–1] or None if X-ray not performed
    blood_prob  : float [0–1] or None if blood test not performed
    lab_result  : True/False or None if GeneXpert not available

    Returns
    -------
    dict with keys:
        tb_positive, confidence, probability, risk_level,
        recommendation, contributing_factors
    """

    if all(v is None for v in [xray_prob, blood_prob, lab_result]):
        return {
            "tb_positive": None,
            "confidence": 0.0,
            "probability": 0.0,
            "risk_level": "UNKNOWN",
            "recommendation": "No test data provided. Please run at least one diagnostic test.",
            "contributing_factors": [],
        }

    # Build weighted inputs
    probs   = {}
    weights = {}

    if lab_result is not None:
        probs["lab"]   = 1.0 if lab_result else 0.0
        weights["lab"] = _BASE_WEIGHTS["lab"]

    if xray_prob is not None:
        probs["xray"]   = float(xray_prob) / 100.0 if xray_prob > 1.0 else float(xray_prob)
        weights["xray"] = _BASE_WEIGHTS["xray"]

    if blood_prob is not None:
        probs["blood"]   = float(blood_prob) / 100.0 if blood_prob > 1.0 else float(blood_prob)
        weights["blood"] = _BASE_WEIGHTS["blood"]

    # Renormalize weights
    total_w = sum(weights.values())
    norm_w  = {k: v / total_w for k, v in weights.items()}

    # Weighted probability
    fused_prob = sum(norm_w[k] * probs[k] for k in probs)

    # Hard override: if GeneXpert is positive, final result is ALWAYS positive
    if lab_result is True:
        fused_prob = max(fused_prob, 0.95)

    tb_positive = fused_prob >= 0.5
    confidence  = fused_prob if tb_positive else (1.0 - fused_prob)
    risk        = _risk_level(fused_prob)
    rec         = _recommendation(risk, tb_positive)

    # Contributing factors summary
    factors = []
    if "lab" in probs:
        factors.append({
            "test": "Lab / GeneXpert",
            "contribution": f"{norm_w['lab']*100:.0f}%",
            "result": "Positive" if lab_result else "Negative",
        })
    if "xray" in probs:
        factors.append({
            "test": "Chest X-ray",
            "contribution": f"{norm_w['xray']*100:.0f}%",
            "result": f"{probs['xray']*100:.1f}% TB probability",
        })
    if "blood" in probs:
        factors.append({
            "test": "Blood Test",
            "contribution": f"{norm_w['blood']*100:.0f}%",
            "result": f"{probs['blood']*100:.1f}% TB probability",
        })

    return {
        "tb_positive": bool(tb_positive),
        "confidence": round(float(confidence) * 100, 2),
        "probability": round(float(fused_prob) * 100, 2),
        "risk_level": risk,
        "recommendation": rec,
        "contributing_factors": factors,
    }

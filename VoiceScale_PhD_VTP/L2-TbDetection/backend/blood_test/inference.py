"""
blood_test/inference.py
Load trained XGBoost pipeline and run inference on blood marker values.
"""

import os
import numpy as np

from blood_test.model import load_pipeline, engineer_features, build_pipeline, HEALTHY_RANGES

# ── Config ────────────────────────────────────────────────────────────────────

WEIGHTS_PATH = os.environ.get(
    "BLOOD_WEIGHTS",
    os.path.join(os.path.dirname(__file__), "weights", "xgb_tb.pkl")
)

# ── Lazy model loader (singleton) ────────────────────────────────────────────

_pipeline = None

def _load_pipeline():
    global _pipeline
    if _pipeline is not None:
        return _pipeline

    if os.path.exists(WEIGHTS_PATH):
        _pipeline = load_pipeline(WEIGHTS_PATH)
        print(f"[blood_test] Loaded pipeline from {WEIGHTS_PATH}")
    else:
        # Demo mode: fit a tiny synthetic pipeline on the fly
        print("[blood_test] WARNING: No trained weights — running in demo mode.")
        from .train import generate_synthetic_data, prepare_features
        df       = generate_synthetic_data(n_samples=500)
        X, y     = prepare_features(df)
        pipeline = build_pipeline()
        pipeline.fit(X, y)
        _pipeline = pipeline

    return _pipeline


# ── Heuristic risk summary ────────────────────────────────────────────────────

def _abnormal_markers(hb, wbc, esr, crp) -> list[str]:
    """Return list of markers outside healthy reference range."""
    abnormal = []
    if not (HEALTHY_RANGES["hemoglobin"][0] <= hb  <= HEALTHY_RANGES["hemoglobin"][1]):
        abnormal.append("Hemoglobin")
    if not (HEALTHY_RANGES["wbc_count"][0]  <= wbc <= HEALTHY_RANGES["wbc_count"][1]):
        abnormal.append("WBC Count")
    if not (HEALTHY_RANGES["esr"][0]        <= esr <= HEALTHY_RANGES["esr"][1]):
        abnormal.append("ESR")
    if not (HEALTHY_RANGES["crp"][0]        <= crp <= HEALTHY_RANGES["crp"][1]):
        abnormal.append("CRP")
    return abnormal


# ── Public API ────────────────────────────────────────────────────────────────

def predict_blood(
    hemoglobin: float,
    wbc_count: float,
    esr: float,
    crp: float,
) -> dict:
    """
    Parameters
    ----------
    hemoglobin : g/dL
    wbc_count  : × 10³/µL
    esr        : mm/hr
    crp        : mg/L

    Returns
    -------
    dict with keys: tb_positive, confidence, probability, message
    """
    pipeline = _load_pipeline()

    X = engineer_features(hemoglobin, wbc_count, esr, crp)
    prob = pipeline.predict_proba(X)[0, 1]

    tb_positive = prob >= 0.5
    confidence  = prob if tb_positive else (1.0 - prob)

    abnormal = _abnormal_markers(hemoglobin, wbc_count, esr, crp)

    if tb_positive:
        msg = (
            f"Blood markers suggest elevated TB risk (probability {prob*100:.1f}%). "
            f"Abnormal markers: {', '.join(abnormal) if abnormal else 'None'}. "
            "Clinical evaluation and sputum culture recommended."
        )
    else:
        msg = (
            f"Blood markers within acceptable range (TB probability {prob*100:.1f}%). "
            f"{'Minor abnormalities noted: ' + ', '.join(abnormal) + '.' if abnormal else 'All values normal.'}"
        )

    return {
        "tb_positive": bool(tb_positive),
        "confidence": round(float(confidence) * 100, 2),
        "probability": round(float(prob) * 100, 2),
        "message": msg,
    }
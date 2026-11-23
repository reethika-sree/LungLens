#!/usr/bin/env python3
"""
Simple training script for blood test model using synthetic data
"""

import os
import sys
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from blood_test.model import build_pipeline, save_pipeline, engineer_features, HEALTHY_RANGES

def generate_synthetic_data(n_samples: int = 1000, seed: int = 42) -> pd.DataFrame:
    """Generate synthetic blood test data"""
    rng = np.random.default_rng(seed)
    n_tb = n_samples // 2
    n_normal = n_samples - n_tb
    
    # Normal patients
    normal = pd.DataFrame({
        "hemoglobin": rng.normal(14.0, 1.5, n_normal).clip(10, 18),
        "wbc_count": rng.normal(7.0, 1.5, n_normal).clip(3, 15),
        "esr": rng.normal(10.0, 5.0, n_normal).clip(0, 20),
        "crp": rng.normal(3.0, 2.0, n_normal).clip(0, 10),
        "label": 0
    })
    
    # TB patients (abnormal values)
    tb = pd.DataFrame({
        "hemoglobin": rng.normal(11.0, 1.8, n_tb).clip(7, 15),
        "wbc_count": rng.normal(10.0, 2.5, n_tb).clip(5, 20),
        "esr": rng.normal(35.0, 15.0, n_tb).clip(15, 80),
        "crp": rng.normal(25.0, 10.0, n_tb).clip(5, 60),
        "label": 1
    })
    
    # Combine and shuffle
    df = pd.concat([normal, tb], ignore_index=True)
    df = df.sample(frac=1, random_state=seed).reset_index(drop=True)
    return df

def prepare_features(df: pd.DataFrame):
    """Apply feature engineering to every row and return X, y."""
    X_list = []
    for _, row in df.iterrows():
        feats = engineer_features(
            hemoglobin=row["hemoglobin"],
            wbc_count=row["wbc_count"],
            esr=row["esr"],
            crp=row["crp"],
        )
        X_list.append(feats.flatten())
    X = np.vstack(X_list)
    y = df["label"].values.astype(int)
    return X, y

def main():
    print("Generating synthetic blood test data...")
    df = generate_synthetic_data(n_samples=1000, seed=42)
    print(f"Generated {len(df)} samples")
    
    print("Preparing features...")
    X, y = prepare_features(df)
    print(f"Feature shape: {X.shape}")
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print("Training XGBoost model...")
    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)
    
    # Evaluate
    y_pred = pipeline.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    print(f"Test accuracy: {accuracy:.3f}")
    
    # Save model
    save_path = "blood_test/weights/xgb_tb.pkl"
    save_pipeline(pipeline, save_path)
    print(f"Model saved to {save_path}")
    
    # Test with sample data
    print("\nTesting with sample blood test values:")
    sample_hb, sample_wbc, sample_esr, sample_crp = 12.5, 9.0, 25.0, 15.0
    sample_features = engineer_features(sample_hb, sample_wbc, sample_esr, sample_crp)
    prob = pipeline.predict_proba(sample_features)[0, 1]
    print(f"Sample prediction (HB={sample_hb}, WBC={sample_wbc}, ESR={sample_esr}, CRP={sample_crp})")
    print(f"TB probability: {prob:.3f}")

if __name__ == "__main__":
    main()

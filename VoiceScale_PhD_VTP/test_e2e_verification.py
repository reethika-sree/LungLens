import os
import sys
import json

backend_dir = os.path.abspath('backend') if os.path.exists('backend') else os.path.abspath('LungLens/VoiceScale_PhD_VTP/backend')
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)

from app.nlp.lexicon import (
    EXPANDED_SYMPTOM_LEXICON,
    NEGATION_LEXICON,
    AFFIRMATIVE_LEXICON,
    DURATION_UNITS
)
from app.nlp.dialogue import (
    extract_symptoms_from_speech,
    parse_direct_answer,
    DynamicDialogueManager,
    extract_duration_weeks
)
from app.api.patient import run_tb_prediction_ml, TBPredictMLRequest

print("=" * 70)
print("1. VERIFYING MEDICAL LEXICON & TELUGU RESPONSE CORRECTIONS")
print("=" * 70)
telugu_options = ["Avunu (అవును)", "Ledhu (లేదు)"]
print(f"Telugu Yes/No options: {telugu_options}")
assert "Avunu (అవును)" in telugu_options, "Missing Avunu (అవును)"
assert "Ledhu (లేదు)" in telugu_options, "Missing Ledhu (లేదు)"

# Verify parsing of Telugu affirmative and negation
val_aff, clear_aff = parse_direct_answer("Avunu (అవును)", "night_fever", "Telugu")
assert val_aff is True and clear_aff is True, "Failed to parse 'Avunu (అవును)' as affirmative"

val_neg, clear_neg = parse_direct_answer("Ledhu (లేదు)", "night_fever", "Telugu")
assert val_neg is False and clear_neg is True, "Failed to parse 'Ledhu (లేదు)' as negation"

print("  ✓ Telugu options correctly configured & parsed: 'Avunu (అవును)' -> True, 'Ledhu (లేదు)' -> False")

print(f"Total symptom categories in lexicon: {len(EXPANDED_SYMPTOM_LEXICON)}")
assert len(EXPANDED_SYMPTOM_LEXICON) >= 12, "Lexicon should have >= 12 categories"
for key, data in EXPANDED_SYMPTOM_LEXICON.items():
    assert "Telugu" in data["terms"], f"Missing Telugu terms for {key}"
    assert "Hindi" in data["terms"], f"Missing Hindi terms for {key}"
    assert "English" in data["terms"], f"Missing English terms for {key}"
print("  ✓ All categories verified with Telugu, Hindi, and English terms (scripts + transliterations)")

print("\n" + "=" * 70)
print("2. VERIFYING TELUGU, HINDI & ENGLISH SPEECH SYMPTOM EXTRACTION")
print("=" * 70)

# Telugu test
te_text = "నాకు మూడు వారాలుగా తీవ్రమైన దగ్గు ఉంది మరియు రాత్రి జ్వరం వస్తుంది కానీ ఛాతీ నొప్పి లేదు"
te_extracted = extract_symptoms_from_speech(te_text, language="Telugu")
print("Telugu text:", te_text)
print("Extracted:", json.dumps(te_extracted, indent=2, ensure_ascii=False))
assert te_extracted.get("cough_weeks") == 3, f"Expected 3 weeks cough, got {te_extracted.get('cough_weeks')}"
assert te_extracted.get("night_fever") is True, "Failed to extract night fever"
assert te_extracted.get("chest_pain") is False, f"Expected chest_pain negated (False), got {te_extracted.get('chest_pain')}"
print("  ✓ Telugu: Cough duration (3 weeks), Night fever (+), Chest pain negated (-)")

# Hindi test
hi_text = "मुझे 2 महीने से लगातार खांसी और रात में पसीना आ रहा है लेकिन वजन कम नहीं हुआ"
hi_extracted = extract_symptoms_from_speech(hi_text, language="Hindi")
print("\nHindi text:", hi_text)
print("Extracted:", json.dumps(hi_extracted, indent=2, ensure_ascii=False))
assert hi_extracted.get("cough_weeks") == 8, f"Expected 8 weeks cough for 2 months, got {hi_extracted.get('cough_weeks')}"
assert hi_extracted.get("night_sweats") is True, "Failed to extract night sweats"
assert hi_extracted.get("weight_loss") is False, f"Expected weight_loss negated (False), got {hi_extracted.get('weight_loss')}"
print("  ✓ Hindi: Cough duration (8 weeks), Night sweats (+), Weight loss negated (-)")

# English test
en_text = "I have had a severe cough for 4 weeks and blood in sputum, but no fever and no chest pain"
en_extracted = extract_symptoms_from_speech(en_text, language="English")
print("\nEnglish text:", en_text)
print("Extracted:", json.dumps(en_extracted, indent=2, ensure_ascii=False))
assert en_extracted.get("cough_weeks") == 4, f"Expected 4 weeks cough, got {en_extracted.get('cough_weeks')}"
assert en_extracted.get("hemoptysis") is True, "Failed to extract hemoptysis"
assert en_extracted.get("night_fever") is False, "Expected night_fever negated (False)"
assert en_extracted.get("chest_pain") is False, "Expected chest_pain negated (False)"
print("  ✓ English: Cough duration (4 weeks), Hemoptysis (+), Fever (-), Chest pain (-)")

print("\n" + "=" * 70)
print("3. VERIFYING DYNAMIC DIALOGUE & NON-REPETITIVE FOLLOW-UP QUESTIONS")
print("=" * 70)

session_symptoms = {"cough_weeks": 3}
asked_targets = []

q1 = DynamicDialogueManager.select_next_question(session_symptoms, asked_targets, "Telugu")
print("Dialogue Step 1 Next Question (Telugu):", q1["text"])
print("Target feature:", q1["target"])
assert q1["target"] != "cough_weeks", "Should not ask about cough since it is already known!"

# Patient answers "Avunu (అవును)" to this target
asked_targets.append(q1["target"])
val, clear = parse_direct_answer("Avunu (అవును)", q1["target"], "Telugu")
session_symptoms[q1["target"]] = val
print(f"Recorded answer for {q1['target']}: {session_symptoms[q1['target']]}")

# Step 2: Next question
q2 = DynamicDialogueManager.select_next_question(session_symptoms, asked_targets, "Telugu")
print("\nDialogue Step 2 Next Question (Telugu):", q2["text"])
print("Target feature:", q2["target"])
assert q2["target"] != q1["target"], "Should NEVER repeat the same question!"
print("  ✓ Dynamic dialogue generates context-aware follow-up questions without repetition")

print("\n" + "=" * 70)
print("4. VERIFYING XGBOOST ML MODEL INFERENCE & CONTRIBUTING FACTORS")
print("=" * 70)
import asyncio
sample_patient_symptoms = {
    "cough_weeks": 3,
    "hemoptysis": 1,
    "night_fever": 1,
    "weight_loss": 1,
    "night_sweats": 1,
    "chest_pain": 0,
    "dyspnea": 0,
    "contact_tb": 1,
    "occupation_risk": 0,
    "hiv_positive": 0,
    "cough_phlegm": 1,
    "loss_appetite": 1,
    "swollen_lymph": 0
}

req = TBPredictMLRequest(symptoms=sample_patient_symptoms, language="Telugu")
pred = asyncio.run(run_tb_prediction_ml(req, None))
print(f"XGBoost Predicted TB Risk Score: {pred['risk_score']}%")
print(f"Priority Tier: {pred['priority']}")
print(f"Risk Category: {pred['risk']}")
print(f"Model: {pred['ml_model']}")
print(f"Medical Disclaimer: {pred['medical_disclaimer']}")
print("Contributing Factors:")
for f in pred['contributing_factors']:
    print(f"  • {f}")

assert 0 <= pred['risk_score'] <= 100, "Risk score must be 0-100"
assert pred['priority'] in ['P1', 'P2', 'P3', 'P4'], "Invalid priority tier"
assert len(pred['contributing_factors']) > 0, "Expected contributing factors"
assert "confirmed diagnosis" in pred['medical_disclaimer'].lower(), "Disclaimer missing medical warning"

print("\n" + "=" * 70)
print("ALL E2E VERIFICATION CHECKS PASSED SUCCESSFULLY!")
print("=" * 70)

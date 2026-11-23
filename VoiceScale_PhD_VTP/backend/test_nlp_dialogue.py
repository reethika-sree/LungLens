from app.nlp.dialogue import extract_symptoms_from_speech, DynamicDialogueManager, parse_direct_answer

# Test 1: Cough + Night fever
s1 = extract_symptoms_from_speech("I have been coughing for three weeks, and I also experience fever at night.", {}, "English")
print("Test 1 symptoms:", s1)
q1 = DynamicDialogueManager.select_next_question(s1, [], "English")
print("Test 1 next Q target:", q1["target"] if q1 else "None")
assert s1["cough_weeks"] == 3, f"Expected 3, got {s1.get('cough_weeks')}"
assert s1["night_fever"] is True, "Expected night_fever True"
assert q1["target"] in ["hemoptysis", "weight_loss", "night_sweats"], f"Unexpected Q: {q1}"

# Test 2: Weight loss + Weakness + No cough
s2 = extract_symptoms_from_speech("I have been experiencing weight loss and weakness, but I don't have a cough.", {}, "English")
print("Test 2 symptoms:", s2)
assert s2["weight_loss"] is True, "Expected weight_loss True"
assert s2["cough_weeks"] == 0, "Expected cough_weeks 0"
q2 = DynamicDialogueManager.select_next_question(s2, [], "English")
print("Test 2 next Q target:", q2["target"] if q2 else "None")
assert q2["target"] != "cough_weeks", "Should not ask cough duration when cough is 0!"

# Test 3: Telugu phrase with negation
s3 = extract_symptoms_from_speech("రెండు వారాలుగా దగ్గు ఉంది, కానీ రక్తం రాలేదు", {}, "Telugu")
print("Test 3 Telugu:", s3)
assert s3["cough_weeks"] == 2, "Expected 2 weeks"
assert s3["hemoptysis"] is False, "Expected hemoptysis False"

# Test 4: Telugu direct answers
val_yes, ok1 = parse_direct_answer("అవును", "night_sweats", "Telugu")
val_no, ok2 = parse_direct_answer("లేదు", "chest_pain", "Telugu")
print("Telugu answer yes:", val_yes, ok1, "no:", val_no, ok2)
assert val_yes is True and ok1 is True
assert val_no is False and ok2 is True

# Test 5: Hindi phrase with negation
s4 = extract_symptoms_from_speech("मुझे रात में बुखार है लेकिन खांसी नहीं है", {}, "Hindi")
print("Test 4 Hindi:", s4)
assert s4["night_fever"] is True, "Expected night fever True in Hindi"
assert s4["cough_weeks"] == 0, "Expected cough 0 in Hindi"

print("\n>>> ALL DIALOGUE UNIT TESTS PASSED SUCCESSFULLY! <<<")


import asyncio
from app.api.patient import run_tb_prediction_ml, start_dynamic_dialogue, step_dynamic_dialogue, TBPredictMLRequest, DialogueStartRequest, DialogueStepRequest

async def test_api_endpoints():
    # Test predict-tb with XGBoost
    req = TBPredictMLRequest(symptoms={'cough_weeks': 3, 'hemoptysis': True, 'night_fever': True})
    res = await run_tb_prediction_ml(req, None)
    print('ML Predict Response:', res['risk'], res['priority'], res['risk_score'], res['ml_model'])
    assert res['priority'] == 'P1', 'Expected P1 with hemoptysis'
    assert 'Medical Disclaimer' in res['medical_disclaimer']

    # Test dialogue start with Telugu speech
    d_req = DialogueStartRequest(language='Telugu', initial_speech='నాకు మూడు వారాల నుండి దగ్గు వస్తోంది రాత్రి జ్వరం ఉంది')
    d_res = await start_dynamic_dialogue(d_req)
    print('Dialogue Start (Telugu):', d_res['reply'])
    print('Target:', d_res['target_symptom'], 'Detected:', d_res['detected_symptoms'])
    assert d_res['target_symptom'] in ['hemoptysis', 'weight_loss'], f"Unexpected target: {d_res['target_symptom']}"

    # Test dialogue step with Telugu answer 'లేదు'
    step_req = DialogueStepRequest(
        language='Telugu',
        message='లేదు రాలేదు',
        state=d_res['state']
    )
    step_res = await step_dynamic_dialogue(step_req)
    print('Dialogue Step (Telugu):', step_res['reply'])
    print('Target:', step_res['target_symptom'], 'Symptoms:', step_res['symptoms'])
    assert step_res['symptoms'][d_res['target_symptom']] is False, 'Expected symptom to be False after లేదు'

    print('\n>>> ALL BACKEND API ENDPOINTS VERIFIED & WORKING PERFECTLY! <<<')

asyncio.run(test_api_endpoints())

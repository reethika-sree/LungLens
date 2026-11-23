"""
VoiceCare PHC — Dynamic Medical Dialogue & Question Generation Engine
Intelligently drives clinical triage interactions based on patient speech content.
Never asks repetitive or already-answered questions.
Supports Telugu, Hindi, and English.
"""

import re
import logging
from typing import Dict, Any, List, Optional, Tuple
from app.nlp.lexicon import (
    EXPANDED_SYMPTOM_LEXICON,
    NEGATION_LEXICON,
    AFFIRMATIVE_LEXICON,
    DURATION_UNITS,
)

logger = logging.getLogger("voicecare.dialogue")

# ─── Clinical Question Bank (Targeted per symptom) ─────────────────────────────
DYNAMIC_QUESTION_BANK = {
    "cough_duration": {
        "target": "cough_weeks",
        "priority": 1,
        "questions": {
            "English": "How long have you had this cough? (e.g. 2 weeks, 1 month, several days)",
            "Telugu": "మీకు ఎంత కాలం నుండి దగ్గు వస్తోంది? (ఉదాహరణకు 2 వారాలు, 1 నెల, లేదా కొన్ని రోజులు)",
            "Hindi": "आपको कितने समय से यह खांसी है? (जैसे 2 हफ्ते, 1 महीना, या कुछ दिन)"
        }
    },
    "hemoptysis": {
        "target": "hemoptysis",
        "priority": 2,  # Major red flag
        "questions": {
            "English": "Do you cough up any blood or see blood stains in your phlegm?",
            "Telugu": "దగ్గినప్పుడు రక్తం పడుతోందా లేదా కఫంలో రక్తం కనిపిస్తోందా?",
            "Hindi": "क्या आपको खांसी में खून आता है या बलगम में खून दिखाई देता है?"
        }
    },
    "night_fever": {
        "target": "night_fever",
        "priority": 3,
        "questions": {
            "English": "Do you experience fever, especially in the evening or at night?",
            "Telugu": "మీకు జ్వరం వస్తోందా, ముఖ్యంగా రాత్రిపూట లేదా సాయంత్రం వేళల్లో?",
            "Hindi": "क्या आपको बुखार रहता है, विशेषकर शाम या रात के समय?"
        }
    },
    "weight_loss": {
        "target": "weight_loss",
        "priority": 4,
        "questions": {
            "English": "Have you noticed any unexplained weight loss or clothes getting looser recently?",
            "Telugu": "మీరు ఇటీవల ఆహారం తగ్గించకుండానే ఆకస్మికంగా బరువు తగ్గారా?",
            "Hindi": "क्या हाल ही में आपका वजन बिना किसी कोशिश के अचानक कम हुआ है?"
        }
    },
    "night_sweats": {
        "target": "night_sweats",
        "priority": 5,
        "questions": {
            "English": "Do you wake up drenched in sweat at night?",
            "Telugu": "రాత్రి నిద్రలో విపరీతంగా చెమటలు పడుతున్నాయా?",
            "Hindi": "क्या आपको रात में सोते समय बहुत अधिक पसीना आता है?"
        }
    },
    "dyspnea": {
        "target": "dyspnea",
        "priority": 6,
        "questions": {
            "English": "Do you have shortness of breath or difficulty breathing?",
            "Telugu": "మీకు ఆయాసం రావడం లేదా శ్వాస తీసుకోవడంలో ఇబ్బందిగా అనిపిస్తోందా?",
            "Hindi": "क्या आपको सांस फूलने या सांस लेने में परेशानी महसूस होती है?"
        }
    },
    "chest_pain": {
        "target": "chest_pain",
        "priority": 7,
        "questions": {
            "English": "Do you experience chest pain, especially when coughing or breathing deeply?",
            "Telugu": "దగ్గినప్పుడు లేదా గాలి పీల్చినప్పుడు ఛాతీలో నొప్పిగా అనిపిస్తోందా?",
            "Hindi": "क्या आपको सीने में दर्द होता है, खासकर खांसते या गहरी सांस लेते समय?"
        }
    },
    "cough_phlegm": {
        "target": "cough_phlegm",
        "priority": 8,
        "questions": {
            "English": "Are you coughing up thick phlegm (mucus) or is it a dry cough?",
            "Telugu": "దగ్గుతో పాటు కఫం లేదా తెమడ పడుతోందా, లేక పొడి దగ్గు మాత్రమేనా?",
            "Hindi": "क्या खांसी के साथ बलगम आ रहा है, या सूखी खांसी है?"
        }
    },
    "loss_appetite": {
        "target": "loss_appetite",
        "priority": 9,
        "questions": {
            "English": "Have you lost your appetite or feel unable to eat properly?",
            "Telugu": "మీకు ఆకలి తగ్గిపోయిందా లేదా అన్నం తినబుద్ధి కావడం లేదా?",
            "Hindi": "क्या आपकी भूख कम हो गई है या खाना खाने का मन नहीं करता?"
        }
    },
    "contact_tb": {
        "target": "contact_tb",
        "priority": 10,
        "questions": {
            "English": "Has anyone in your household or close family had Tuberculosis (TB)?",
            "Telugu": "మీ ఇంట్లో లేదా కుటుంబంలో ఎవరికైనా టీబీ (క్షయ) వ్యాధి సోకిందా?",
            "Hindi": "क्या आपके घर या परिवार में किसी को टीबी (क्षय रोग) हुआ है?"
        }
    },
    "occupation_risk": {
        "target": "occupation_risk",
        "priority": 11,
        "questions": {
            "English": "Do you work in mining, construction, stone crushing, or dusty environments?",
            "Telugu": "మీరు గనులు, భవన నిర్మాణం లేదా ధూళి ఎక్కువగా ఉండే ప్రదేశాల్లో పని చేస్తారా?",
            "Hindi": "क्या आप खदान, निर्माण कार्य, या धूल-मिट्टी वाली जगह पर काम करते हैं?"
        }
    },
    "swollen_lymph": {
        "target": "swollen_lymph",
        "priority": 12,
        "questions": {
            "English": "Have you noticed any swollen lumps or nodules in your neck or armpits?",
            "Telugu": "మీ మెడ లేదా చంకలలో గడ్డలు లేదా వాపు ఏమైనా గమనించారా?",
            "Hindi": "क्या आपके गले या कांख में कोई गांठ या सूजन महसूस हुई है?"
        }
    }
}

# ─── Clinical Clause Splitter ──────────────────────────────────────────────────
CLAUSE_DELIMITERS = (
    r'[,;\.\n!\?]|'
    r'(?:\b(?:but|however|although|though|except|yet|and|while|whereas)\b)|'
    r'(?:కానీ|అయితే|మరియు|లేదా|ఐనా)|'
    r'(?:लेकिन|पर|और|मगर|बल्कि|किन्तु|परन्तु)'
)


def split_into_clauses(text: str) -> List[str]:
    """Split medical text into clinical clauses so negations don't bleed across symptoms."""
    clauses = [c.strip() for c in re.split(CLAUSE_DELIMITERS, text, flags=re.IGNORECASE) if c.strip()]
    return clauses if clauses else [text.strip()]


def is_clause_negated(clause: str, match_pos: int, match_len: int, language: str = "English") -> bool:
    """
    Check if a specific symptom keyword match inside a clause is negated.
    Evaluates a 45-character bidirectional window against multilingual negation terms.
    Uses proper token boundary detection to prevent sub-word false positives (e.g. 'ना' inside 'पसीना').
    """
    start = max(0, match_pos - 45)
    end = min(len(clause), match_pos + match_len + 45)
    window = clause[start:end].lower()

    # Check language specific negations first, then fallback
    negations = list(NEGATION_LEXICON.get(language, []))
    for lang in ["English", "Telugu", "Hindi"]:
        for n in NEGATION_LEXICON.get(lang, []):
            if n not in negations:
                negations.append(n)

    for neg in negations:
        neg_clean = neg.strip().lower()
        if not neg_clean:
            continue
        # Check boundary-delimited pattern
        pattern = r'(?:^|[\s,;।!?\.\-_])' + re.escape(neg_clean) + r'(?:$|[\s,;।!?\.\-_])'
        if re.search(pattern, window, flags=re.UNICODE):
            return True

    return False


def extract_duration_weeks(text: str) -> Optional[int]:
    """Parse numeric durations like '3 weeks', '2 months', '15 days', 'మూడు వారాల', '2 महीने'."""
    text_lower = text.lower()

    # Direct digit pattern: e.g. "3 weeks", "2 months", "15 days", "3 వారాల", "2 महीने"
    m = re.search(r'(\d+)\s*([a-zA-Z\u0C00-\u0C7F\u0900-\u097F]+)', text_lower)
    if m:
        num = int(m.group(1))
        unit = m.group(2).strip()
        if any(u in unit for u in DURATION_UNITS["month"]):
            return num * 4
        elif any(u in unit for u in DURATION_UNITS["week"]):
            return num
        elif any(u in unit for u in DURATION_UNITS["day"]):
            return max(1, round(num / 7))

    # Word numbers in English, Telugu, Hindi and transliterations
    word_nums = {
        "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
        "ఒకటి": 1, "రెండు": 2, "మూడు": 3, "నాలుగు": 4, "ఐదు": 5, "ఆరు": 6, "ఒక": 1,
        "rendu": 2, "moodu": 3, "nalugu": 4, "aidu": 5,
        "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पाँच": 5, "पांच": 5, "छह": 6,
        "ek": 1, "do": 2, "teen": 3, "chaar": 4, "char": 4, "paanch": 5
    }
    for w, val in word_nums.items():
        if w in text_lower:
            m_word = re.search(rf'{w}\s*([a-zA-Z\u0C00-\u0C7F\u0900-\u097F]+)', text_lower)
            if m_word:
                unit = m_word.group(1).strip()
                if any(u in unit for u in DURATION_UNITS["month"]):
                    return val * 4
                elif any(u in unit for u in DURATION_UNITS["week"]):
                    return val
                elif any(u in unit for u in DURATION_UNITS["day"]):
                    return max(1, round(val / 7))

    return None


def extract_symptoms_from_speech(text: str, current_symptoms: Optional[Dict[str, Any]] = None, language: str = "English") -> Dict[str, Any]:
    """
    Extract structured medical symptoms and duration from free-text speech.
    Supports Telugu, Hindi, English with robust negation handling.
    """
    symptoms = dict(current_symptoms or {})
    clauses = split_into_clauses(text)
    duration = extract_duration_weeks(text)

    # 1. Process Cough specifically
    cough_meta = EXPANDED_SYMPTOM_LEXICON["cough"]
    cough_found = False
    cough_negated = False

    for c in clauses:
        c_lower = c.lower()
        for lang_key in ["English", "Telugu", "Hindi"]:
            for term in cough_meta["terms"].get(lang_key, []):
                pos = c_lower.find(term.lower())
                if pos != -1:
                    cough_found = True
                    if is_clause_negated(c_lower, pos, len(term), language):
                        cough_negated = True
                    break
            if cough_found:
                break

    if cough_negated:
        symptoms["cough_weeks"] = 0
    elif cough_found:
        if duration is not None:
            symptoms["cough_weeks"] = duration
        elif symptoms.get("cough_weeks") is None:
            # Cough confirmed but duration not yet stated
            symptoms["cough_weeks"] = "mentioned_unknown_duration"
    elif duration is not None:
        symptoms["cough_weeks"] = duration

    # 2. Process all other lexicon symptoms
    for sym_key, sym_info in EXPANDED_SYMPTOM_LEXICON.items():
        if sym_key == "cough":
            continue

        for c in clauses:
            c_lower = c.lower()
            found_in_clause = False

            for lang_key in ["English", "Telugu", "Hindi"]:
                for term in sym_info["terms"].get(lang_key, []):
                    pos = c_lower.find(term.lower())
                    if pos != -1:
                        found_in_clause = True
                        if is_clause_negated(c_lower, pos, len(term), language):
                            symptoms[sym_key] = False
                        else:
                            symptoms[sym_key] = True
                        break
                if found_in_clause:
                    break

    return symptoms


def parse_direct_answer(message: str, target_symptom: str, language: str = "English") -> Tuple[Optional[Any], bool]:
    """
    Interpret direct answers like 'Avunu (అవును)', 'Ledhu (లేదు)', 'Yes', 'No', '2 weeks'
    for the symptom currently being questioned.
    Returns (value, is_clear).
    """
    msg = message.strip().lower()

    # 1. Check for numeric duration if target is cough_weeks
    if target_symptom in ("cough_weeks", "cough_duration"):
        dur = extract_duration_weeks(msg)
        if dur is not None:
            return dur, True

    # 2. Check Affirmative Markers (Avunu, Yes, Haan, etc.)
    all_affirmatives = []
    for l in ["English", "Telugu", "Hindi"]:
        all_affirmatives.extend(AFFIRMATIVE_LEXICON.get(l, []))

    for aff in all_affirmatives:
        if re.search(r'(?:\b|_|\s|^)' + re.escape(aff.lower()) + r'(?:\b|_|\s|$)', msg) or aff.lower() == msg:
            if target_symptom in ("cough_weeks", "cough_duration"):
                return 3, True  # Default presumptive duration if yes without number
            return True, True

    # 3. Check Negation Markers (Ledhu, No, Nahi, etc.)
    all_negatives = []
    for l in ["English", "Telugu", "Hindi"]:
        all_negatives.extend(NEGATION_LEXICON.get(l, []))

    for neg in all_negatives:
        if re.search(r'(?:\b|_|\s|^)' + re.escape(neg.lower()) + r'(?:\b|_|\s|$)', msg) or neg.lower() == msg:
            if target_symptom in ("cough_weeks", "cough_duration"):
                return 0, True
            return False, True

    # 4. If full sentence spoken, run clause extraction
    extracted = extract_symptoms_from_speech(message, {}, language)
    if target_symptom in extracted and extracted[target_symptom] is not None:
        return extracted[target_symptom], True

    # Not confident -> ask for clarification
    return None, False


class DynamicDialogueManager:
    """
    Manages a session's clinical follow-up questionnaire.
    Picks the next most crucial clinical question based on missing TB criteria.
    """

    @staticmethod
    def select_next_question(
        symptoms: Dict[str, Any],
        asked_targets: List[str],
        language: str = "English"
    ) -> Optional[Dict[str, Any]]:
        """
        Dynamically choose the next best question based on missing data.
        Never repeats a question or asks about already established symptoms.
        """
        # If cough is mentioned but duration unknown, that's top priority
        if symptoms.get("cough_weeks") == "mentioned_unknown_duration" and "cough_duration" not in asked_targets:
            q_spec = DYNAMIC_QUESTION_BANK["cough_duration"]
            return {
                "key": "cough_duration",
                "target": "cough_weeks",
                "text": q_spec["questions"].get(language, q_spec["questions"]["English"]),
                "requires_number": True
            }

        # Otherwise sort question bank by priority
        sorted_bank = sorted(DYNAMIC_QUESTION_BANK.items(), key=lambda item: item[1]["priority"])

        for key, spec in sorted_bank:
            target = spec["target"]
            # Skip if already asked
            if key in asked_targets or target in asked_targets:
                continue

            # Skip if symptom is already known (positive or negative)
            val = symptoms.get(target)
            if val is not None and val != "mentioned_unknown_duration":
                continue

            # Special case: don't ask cough duration or cough phlegm if patient has NO cough
            if target in ("cough_weeks", "cough_phlegm") and symptoms.get("cough_weeks") == 0:
                continue

            # This is our next dynamic question
            q_text = spec["questions"].get(language, spec["questions"]["English"])
            return {
                "key": key,
                "target": target,
                "text": q_text,
                "requires_number": False
            }

        return None

    @staticmethod
    def should_terminate(symptoms: Dict[str, Any], rounds_completed: int) -> bool:
        """
        Determine if sufficient information has been collected:
        - 4-5 dynamic rounds answered
        - OR red-flag hemoptysis confirmed with prolonged cough
        - OR all primary symptoms known
        """
        if rounds_completed >= 5:
            return True

        # Check critical red flags
        if symptoms.get("hemoptysis") is True and isinstance(symptoms.get("cough_weeks"), (int, float)) and symptoms.get("cough_weeks", 0) >= 2:
            if rounds_completed >= 3:
                return True

        # Count how many primary symptoms are established
        primary_keys = ["cough_weeks", "hemoptysis", "night_fever", "weight_loss", "dyspnea", "night_sweats"]
        known_count = sum(1 for k in primary_keys if symptoms.get(k) is not None and symptoms.get(k) != "mentioned_unknown_duration")

        if known_count >= 5:
            return True

        return False

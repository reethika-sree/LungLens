"""
VoiceCare PHC — Expanded Multilingual Medical Lexicon
Language Support: Telugu, Hindi, English
Organized by clinical symptom categories with native script, transliteration,
synonyms, colloquial terms, and negation rules.
"""

# ─── Symptom Lexicon by Category ───────────────────────────────────────────────
# Maps internal feature keys to lists of multilingual clinical and conversational tokens.
# Both native scripts and common transliterations / variations are covered.

EXPANDED_SYMPTOM_LEXICON = {
    # ── 1. Cough & Respiratory Symptoms ──────────────────────────────────────
    "cough": {
        "category": "respiratory",
        "description": "Cough / Persistent cough",
        "terms": {
            "English": [
                "cough", "coughing", "persistent cough", "chronic cough", "dry cough",
                "continuous cough", "frequent cough", "bad cough", "hacking cough",
                "cough for weeks", "coughing a lot", "cough problem", "throat irritation"
            ],
            "Telugu": [
                # Telugu script
                "దగ్గు", "తీవ్రమైన దగ్గు", "పొడి దగ్గు", "నిరంతర దగ్గు", "చాలా రోజులుగా దగ్గు",
                "దగ్గు ఆగట్లేదు", "దగ్గుతో ఇబ్బంది", "గట్టి దగ్గు", "దగ్గు వస్తోంది",
                # Transliteration & phonetic variants
                "daggu", "daggulu", "teevramaina daggu", "podi daggu", "daggu vastondi",
                "chala rojula nunchi daggu", "daggu aagatledu", "daggu undi"
            ],
            "Hindi": [
                # Devanagari script
                "खांसी", "खाँसी", "लगातार खांसी", "सूखी खांसी", "पुरानी खांसी",
                "कई हफ्तों से खांसी", "खांसना", "खांसी की समस्या", "खांसी आ रही है",
                # Transliteration & phonetic variants
                "khansi", "khaansi", "lagatar khansi", "sookhi khansi", "purani khansi",
                "khansi aa rahi hai", "khansna", "dhasak", "dhaska"
            ]
        }
    },

    "cough_phlegm": {
        "category": "respiratory",
        "description": "Productive cough / Phlegm / Sputum",
        "terms": {
            "English": [
                "phlegm", "sputum", "mucus", "productive cough", "wet cough",
                "coughing up phlegm", "cough with phlegm", "mucus in throat",
                "thick sputum", "green sputum", "yellow sputum", "thick phlegm"
            ],
            "Telugu": [
                "కఫం", "తెమడ", "కఫంతో దగ్గు", "పచ్చి దగ్గు", "గొంతులో కఫం",
                "తెమడ పడటం", "గారెల కఫం",
                "kafam", "kapham", "temada", "kafamtho daggu", "gonthulo kafam",
                "temada padatam"
            ],
            "Hindi": [
                "बलगम", "कफ", "बलगम वाली खांसी", "कफ वाली खांसी", "बलगम आना",
                "गाढ़ा बलगम", "कफ आना",
                "balgam", "kaf", "balgam wali khansi", "kaf wali khansi",
                "balgam aana", "gaddha balgam"
            ]
        }
    },

    "hemoptysis": {
        "category": "respiratory_redflag",
        "description": "Blood in sputum / Coughing blood (Critical Red Flag)",
        "terms": {
            "English": [
                "hemoptysis", "haemoptysis", "blood in cough", "blood in sputum",
                "coughing blood", "coughing up blood", "blood in phlegm",
                "blood stains in spit", "red phlegm", "spitting blood", "blood spitting"
            ],
            "Telugu": [
                "రక్తం", "దగ్గులో రక్తం", "నెత్తురు", "కఫంలో రక్తం", "రక్తం పడటం",
                "దగ్గినప్పుడు రక్తం", "నెత్తురు పడుతోంది", "దగ్గుతో రక్తం",
                "raktam", "daggulo raktam", "netturu", "kafamlo raktam",
                "raktam padatam", "dagginappudu raktam", "netturu paduthondi"
            ],
            "Hindi": [
                "खून", "खांसी में खून", "बलगम में खून", "थूक में खून", "रक्त",
                "खांसते समय खून", "खून की उल्टी", "खून आना",
                "khoon", "khansi mein khoon", "balgam mein khoon", "thook mein khoon",
                "rakt", "khansi me khun", "khoon aana"
            ]
        }
    },

    "dyspnea": {
        "category": "respiratory",
        "description": "Shortness of breath / Difficulty breathing / Dyspnea",
        "terms": {
            "English": [
                "shortness of breath", "difficulty breathing", "breathless",
                "breathlessness", "dyspnea", "breath trouble", "hard to breathe",
                "gasping", "can't breathe properly", "winded", "wheezing", "tight chest breathing"
            ],
            "Telugu": [
                "శ్వాస", "శ్వాస ఆడకపోవడం", "ఆయాసం", "దమ్ము", "శ్వాస తీసుకోవడంలో ఇబ్బంది",
                "ఊపిరాడకపోవడం", "రొప్పు", "గురక", "శ్వాస అందట్లేదు",
                "shwasa", "shwasa aadakapovadam", "aayasam", "dammu",
                "shwasa teesukovadamlo ibbandi", "oopiraadakapovadam", "roppu",
                "shwasa andatledu", "aayasamga undi"
            ],
            "Hindi": [
                "सांस", "सांस फूलना", "दम फूलना", "सांस लेने में तकलीफ", "सांस रुकना",
                "दम घुटना", "हांफना", "सांस की दिक्कत", "सांस नहीं आ रही",
                "saans", "saans phoolna", "dam phoolna", "saans lene me takleef",
                "dam ghutna", "haaphna", "saans ki dikkat", "saans phulna"
            ]
        }
    },

    "chest_pain": {
        "category": "pain",
        "description": "Chest pain / Tightness in chest",
        "terms": {
            "English": [
                "chest pain", "pain in chest", "chest discomfort", "tight chest",
                "chest ache", "stabbing chest pain", "pain while coughing",
                "lung pain", "rib pain"
            ],
            "Telugu": [
                "ఛాతీ నొప్పి", "రొమ్ము నొప్పి", "గుండెల్లో నొప్పి", "ఛాతీ పట్టేయడం",
                "దగ్గినప్పుడు ఛాతీ నొప్పి", "ఎద నొప్పి",
                "chaathi noppi", "rommu noppi", "gundello noppi", "chaati noppi",
                "dagginappudu chaathi noppi", "eda noppi"
            ],
            "Hindi": [
                "सीने में दर्द", "छाती में दर्द", "सीने में जकड़न", "छाती में खिंचाव",
                "खांसने पर सीने में दर्द", "छाती भारी होना",
                "seene mein dard", "chhati mein dard", "seene me dard",
                "chhati me dard", "seene me jakdan"
            ]
        }
    },

    # ── 2. Systemic & Constitutional Symptoms ─────────────────────────────────
    "night_fever": {
        "category": "constitutional",
        "description": "Fever / Night fever / Evening rise of temperature",
        "terms": {
            "English": [
                "fever", "night fever", "high fever", "temperature", "high temp",
                "evening fever", "low grade fever", "chills", "shivering with fever",
                "fever at night", "burning body", "feverish"
            ],
            "Telugu": [
                "జ్వరం", "రాత్రి జ్వరం", "సాయంత్రం జ్వరం", "చలి జ్వరం", "తీవ్రమైన జ్వరం",
                "ఒళ్లు వేడిగా ఉండటం", "వణుకు జ్వరం", "జ్వరం వస్తోంది",
                "jwaram", "raatri jwaram", "saayantram jwaram", "chali jwaram",
                "ollu vediga undatam", "rathri jwaram", "jvaram"
            ],
            "Hindi": [
                "बुखार", "रात का बुखार", "शाम का बुखार", "तेज बुखार", "ताप",
                "हरारत", "कंपकंपी वाला बुखार", "ठंड लगकर बुखार", "बुखार आ रहा है",
                "bukhar", "raat ka bukhar", "shaam ka bukhar", "tez bukhar",
                "taap", "hararat", "thand lagkar bukhar"
            ]
        }
    },

    "night_sweats": {
        "category": "constitutional",
        "description": "Night sweats / Drenching sweats during sleep",
        "terms": {
            "English": [
                "night sweat", "night sweats", "sweating at night", "excessive sweating",
                "waking up in sweat", "drenched in sweat", "cold sweats at night",
                "sweating while sleeping"
            ],
            "Telugu": [
                "రాత్రి చెమటలు", "నిద్రలో చెమటలు", "రాత్రిపూట చెమట", "విపరీతమైన చెమట",
                "నిద్రలో ఒళ్లంతా చెమటలు", "రాత్రి చెమట పట్టడం",
                "raatri chematalu", "nidralo chematalu", "rathri chematalu",
                "vipareetamaina chematalu", "chemata pattadam"
            ],
            "Hindi": [
                "रात में पसीना", "रात को पसीना आना", "सोते समय पसीना", "पसीना छूटना",
                "रात में तर-बतर होना", "पसीना आना",
                "raat mein paseena", "raat ko pasina", "sote samay pasina",
                "pasina aana", "paseena chhootna"
            ]
        }
    },

    "weight_loss": {
        "category": "constitutional",
        "description": "Unexplained weight loss / Getting thin",
        "terms": {
            "English": [
                "weight loss", "losing weight", "lost weight", "clothes getting loose",
                "getting thin", "becoming skinny", "wasting away", "drastic weight loss",
                "unexplained weight drop", "dropped weight"
            ],
            "Telugu": [
                "బరువు తగ్గడం", "బరువు తగ్గింది", "చిక్కిపోవడం", "బక్కచిక్కిపోవడం",
                "శరీరం తగ్గడం", "ఒళ్ళు కరిగిపోవడం", "బరువు తగ్గిపోయాను", "బరువు తగ్గ",
                "baruvu taggadam", "baruvu taggindi", "chikkipovadam",
                "bakkachikkipovadam", "shareeram taggadam", "baruvu taggipoyanu", "baruvu tagga"
            ],
            "Hindi": [
                "वजन कम होना", "वजन घटना", "दुबला होना", "शरीर गिरना", "वजन कम",
                "कपड़े ढीले होना", "सूख जाना", "वजन बहुत घट गया है", "वजन घटा",
                "wajan kam hona", "vajan ghatna", "dubla hona", "shareer girna",
                "wajan gir gaya", "sookh jana", "wajan kam", "vajan kam"
            ]
        }
    },

    "loss_appetite": {
        "category": "constitutional",
        "description": "Loss of appetite / Poor eating",
        "terms": {
            "English": [
                "loss of appetite", "poor appetite", "not eating", "not feeling hungry",
                "no hunger", "don't feel like eating", "eating very little",
                "food aversion", "lack of appetite"
            ],
            "Telugu": [
                "ఆకలి లేకపోవడం", "ఆకలి మందగించడం", "తినబుద్ధి కావడం లేదు",
                "అన్నం సహించకపోవడం", "ఆకలి వేయట్లేదు", "తినాలనిపించట్లేదు",
                "aakali lekapovadam", "aakali mandaginchadam", "tinabuddhi kaavadam ledu",
                "aakali veyatledu", "annam sahinchakapovadam", "tinalanipinchadam ledu"
            ],
            "Hindi": [
                "भूख न लगना", "भूख कम लगना", "भूख मर जाना", "खाना न भाना",
                "खाने की इच्छा न होना", "रोटी नहीं पच रही", "भूख नहीं लगती",
                "bhookh na lagna", "bhookh kam lagna", "bhookh mar jana",
                "khana na bhaana", "bhookh nahi lagti", "khane ka man nahi"
            ]
        }
    },

    "fatigue_weakness": {
        "category": "constitutional",
        "description": "Fatigue / Weakness / Dizziness / Tiredness",
        "terms": {
            "English": [
                "fatigue", "tiredness", "exhaustion", "weakness", "dizziness",
                "feeling faint", "dizzy", "lethargy", "loss of energy", "body weakness",
                "no energy", "feeling completely exhausted"
            ],
            "Telugu": [
                "అలసట", "నీరసం", "బలహీనత", "నిస్సత్తువ", "కళ్ళు తిరగడం", "తల తిరగడం",
                "ఓపిక లేకపోవడం", "ఒంట్లో శక్తి లేదు", "బాగా నీరసంగా ఉంది",
                "alasata", "neerasam", "balaheenatha", "nissattuva",
                "kallu thiragadam", "thala thiragadam", "opika lekapovadam", "neerasamga undi"
            ],
            "Hindi": [
                "थकान", "कमजोरी", "चक्कर आना", "सिर घूमना", "सुस्ती", "अशक्तता",
                "हिम्मत न होना", "शरीर में जान न होना", "बहुत थकावट",
                "thakan", "kamzori", "chakkar aana", "sir ghoomna",
                "susti", "ashaktata", "thakawat", "bahut kamzori"
            ]
        }
    },

    "headache_body_pain": {
        "category": "pain",
        "description": "Headache / Body aches / Chills",
        "terms": {
            "English": [
                "headache", "body pain", "body ache", "joint pain", "muscle pain",
                "head throbbing", "aching all over", "chills and aches"
            ],
            "Telugu": [
                "తల నొప్పి", "ఒళ్ళు నొప్పులు", "శరీర నొప్పులు", "కీళ్ళ నొప్పులు", "నడుము నొప్పి",
                "thala noppi", "ollu noppulu", "shareera noppulu", "keella noppulu"
            ],
            "Hindi": [
                "सिर दर्द", "बदन दर्द", "हाथ पैर में दर्द", "जोड़ों का दर्द", "अंग-अंग टूटना",
                "sir dard", "badan dard", "hath pair dard", "jodon me dard"
            ]
        }
    },

    "swollen_lymph": {
        "category": "physical_sign",
        "description": "Swollen lymph nodes / Neck lumps",
        "terms": {
            "English": [
                "swollen lymph", "lymph nodes", "swollen glands", "neck lump",
                "lump in neck", "armpit lump", "groin lump", "swelling in neck"
            ],
            "Telugu": [
                "మెడ గడ్డలు", "గడ్డలు", "బిళ్లలు", "చంకలో గడ్డలు", "గొంతు దగ్గర వాపు",
                "meda gaddalu", "gaddalu", "billalu", "chankalo gaddalu", "gonthu vaapu"
            ],
            "Hindi": [
                "गले की गांठ", "गांठ", "सूजन", "कांख में गांठ", "गिल्टी",
                "gale ki gaanth", "gaanth", "soojan", "kankh me ganth", "gilti"
            ]
        }
    },

    # ── 3. Epidemiological & Risk Factors ─────────────────────────────────────
    "contact_tb": {
        "category": "risk_factor",
        "description": "Household / close contact with a confirmed TB patient",
        "terms": {
            "English": [
                "tb contact", "contact with tb", "household tb", "family tb",
                "someone at home has tb", "exposure to tb", "tb in family", "tb patient contact"
            ],
            "Telugu": [
                "టీబీ పరిచయం", "ఇంట్లో టీబీ", "కుటుంబంలో టీబీ", "ఎవరికైనా క్షయ", "ఇంట్లో క్షయ రోగి",
                "tb parichayam", "intlo tb", "kutumbamlo tb", "intlo kshaya"
            ],
            "Hindi": [
                "टीबी संपर्क", "घर में टीबी", "परिवार में टीबी", "टीबी का मरीज", "क्षय रोग संपर्क",
                "tb sampark", "ghar me tb", "parivar me tb", "tb ka mareez"
            ]
        }
    },

    "occupation_risk": {
        "category": "risk_factor",
        "description": "Occupational dust exposure (mining, construction, quarrying)",
        "terms": {
            "English": [
                "mine", "mining", "quarry", "dust exposure", "construction worker",
                "cement dust", "stone cutting", "factory worker", "silica dust"
            ],
            "Telugu": [
                "గని", "మైనింగ్", "ధూళి", "నిర్మాణ పని", "సిమెంట్ పని", "రాతి పని",
                "gani", "mining", "dhooli", "nirmaana pani", "raati pani"
            ],
            "Hindi": [
                "खदान", "खनन", "धूल", "निर्माण कार्य", "मजदूरी", "पत्थर काटना",
                "khadaan", "khanan", "dhool", "nirmaan karya", "patthar todna"
            ]
        }
    },

    "hiv_positive": {
        "category": "risk_factor",
        "description": "HIV positive / Immunocompromised status",
        "terms": {
            "English": [
                "hiv", "hiv positive", "aids", "immunocompromised", "art clinic"
            ],
            "Telugu": [
                "హెచ్ఐవి", "ఎయిడ్స్", "hiv"
            ],
            "Hindi": [
                "एचआईवी", "एड्स", "hiv"
            ]
        }
    }
}


# ─── Negation Markers by Language ─────────────────────────────────────────────
# Tokens indicating negation within an utterance
NEGATION_LEXICON = {
    "English": [
        "no", "not", "dont", "don't", "doesnt", "doesn't", "didnt", "didn't",
        "havent", "haven't", "hasnt", "hasn't", "without", "never", "denies",
        "denied", "none", "neither", "nil", "zero", "negative", "free of"
    ],
    "Telugu": [
        "లేదు", "కాదు", "లేవు", "పడలేదు", "రాలేదు", "తగ్గలేదు", "రావడం లేదు",
        "అస్సలు లేదు", "ఏమీ లేదు", "కలగలేదు", "జరగలేదు", "ఉండదు", "వద్దు",
        # Transliterations
        "ledhu", "ledu", "kaadu", "levu", "padaledu", "raledu", "taggaledu",
        "ravadam ledu", "assalu ledu", "emi ledu", "undadu", "vaddu"
    ],
    "Hindi": [
        "नहीं", "नही", "ना", "बिना", "नहीं है", "नहीं आया", "बिल्कुल नहीं",
        "कोई नहीं", "नहीं हो रहा", "कभी नहीं", "नकार", "नहीं था",
        # Transliterations
        "nahi", "nahin", "na", "bina", "nahi hai", "nahi aaya", "bilkul nahi",
        "koi nahi", "kabhi nahi", "nahi tha"
    ]
}


# ─── Affirmative Response Markers by Language ─────────────────────────────────
# Tokens indicating confirmation / yes
AFFIRMATIVE_LEXICON = {
    "English": [
        "yes", "yeah", "yep", "yup", "correct", "true", "present", "i have",
        "i do", "suffering", "experiencing", "positive", "affirmative", "sure"
    ],
    "Telugu": [
        "అవును", "అవునండి", "ఉంది", "ఉన్నాయి", "వస్తోంది", "వచ్చింది",
        "నిజమే", "బాధపడుతున్నాను",
        # Transliterations
        "avunu", "avunandi", "undi", "undhi", "unnayi", "vastondi", "vachindi",
        "nijame", "ha"
    ],
    "Hindi": [
        "हाँ", "हां", "जी हाँ", "जी हां", "सही", "होता है", "आता है",
        "है", "हो रहा है", "बिल्कुल", "पक्का",
        # Transliterations
        "haan", "ha", "ji haan", "sahi", "hota hai", "aata hai", "hai",
        "ho raha hai", "bilkul"
    ]
}


# ─── Duration Extraction Patterns ─────────────────────────────────────────────
# Regex friendly units for mapping duration to weeks
DURATION_UNITS = {
    "week": [
        "week", "weeks", "వారం", "వారాలు", "వారాల", "హफ्ते", "हफ़्ते", "हफ्ता", "हफ्तों", "हफ़्तों",
        "vaaram", "vaaralu", "vaarala", "hafte", "hafton"
    ],
    "month": [
        "month", "months", "నెల", "నెలలు", "నెలల", "महीना", "महीने", "महीनों",
        "nela", "nelalu", "nelala", "mahina", "mahine", "mahino"
    ],
    "day": [
        "day", "days", "రోజు", "రోజులు", "రోజుల", "दिन", "दिनों",
        "roju", "rojulu", "rojula", "din", "dino"
    ],
}

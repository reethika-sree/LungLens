import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import translations, { type LangKey, type Translations } from '../../contexts/translations';

const STORAGE_KEY = 'vc_patient_language';

interface LanguageState {
  language: LangKey;
}

const getSavedLang = (): LangKey => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in translations) return saved as LangKey;
  } catch {}
  return 'English';
};

const initialState: LanguageState = {
  language: getSavedLang(),
};

export const languageSlice = createSlice({
  name: 'language',
  initialState,
  reducers: {
    setLanguage: (state, action: PayloadAction<LangKey>) => {
      state.language = action.payload;
      try {
        localStorage.setItem(STORAGE_KEY, action.payload);
      } catch {}
    },
  },
});

export const { setLanguage } = languageSlice.actions;
export default languageSlice.reducer;

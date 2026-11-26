import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface SymptomState {
  cough: boolean;
  cough_duration_weeks: number;
  fever: boolean;
  fever_duration_weeks: number;
  weight_loss: boolean;
  night_sweats: boolean;
  hemoptysis: boolean;
  chest_pain: boolean;
  shortness_of_breath: boolean;
  fatigue: boolean;
  loss_of_appetite: boolean;
  history_of_tb: boolean;
  household_tb_contact: boolean;
  diabetes: boolean;
  hiv_status: boolean;
  smoking: boolean;
  alcohol_use: boolean;
}

interface TriageState {
  symptoms: Partial<SymptomState>;
  riskScore: number | null;
  priorityTier: 'P1' | 'P2' | 'P3' | null;
  consultationId: string | null;
  l2Referred: boolean;
}

const initialState: TriageState = {
  symptoms: {},
  riskScore: null,
  priorityTier: null,
  consultationId: null,
  l2Referred: localStorage.getItem('vc_l2_referred') === 'true',
};

export const triageSlice = createSlice({
  name: 'triage',
  initialState,
  reducers: {
    updateSymptoms: (state, action: PayloadAction<Partial<SymptomState>>) => {
      state.symptoms = { ...state.symptoms, ...action.payload };
    },
    setPrediction: (
      state,
      action: PayloadAction<{ riskScore: number; priorityTier: 'P1' | 'P2' | 'P3'; consultationId?: string }>
    ) => {
      state.riskScore = action.payload.riskScore;
      state.priorityTier = action.payload.priorityTier;
      if (action.payload.consultationId) {
        state.consultationId = action.payload.consultationId;
      }
    },
    setL2Referred: (state, action: PayloadAction<boolean>) => {
      state.l2Referred = action.payload;
      localStorage.setItem('vc_l2_referred', action.payload ? 'true' : 'false');
    },
    resetTriage: (state) => {
      state.symptoms = {};
      state.riskScore = null;
      state.priorityTier = null;
      state.consultationId = null;
    },
  },
});

export const { updateSymptoms, setPrediction, setL2Referred, resetTriage } = triageSlice.actions;
export default triageSlice.reducer;


export interface ParagraphAnalysis {
  originalText: string;
  explanation: string;
}

export interface ExampleWithExplanation {
  text: string;
  explanation: string;
}

export interface AnalysisResult {
  concept: string;
  paragraphs?: ParagraphAnalysis[];
  subjectExamples: ExampleWithExplanation[];
  realWorldExamples: {
    persona: string;
    scenario: string;
    explanation: string;
  }[];
}

export interface AssessmentPageResult {
  pageNumber: number;
  score: number;
  critique: {
    wrongPoint: string;
    correction: string;
  }[];
  summary: string;
}

export interface AssessmentResult {
  overallScore: number;
  pages: AssessmentPageResult[];
  generalFeedback: string;
}

export interface ListenToMeResult {
  correctnessPercentage: number;
  transcription: string;
  grammarMistakes: {
    error: string;
    correction: string;
    explanation: string;
  }[];
  contentFeedback: {
    missedPoints: string[];
    accuracyReview: string;
  };
  enhancementSuggestions: string[];
}

export type FileType = 'pdf' | 'image' | 'text' | null;
export type VoiceOption = 'Kore' | 'Charon' | 'Puck' | 'Fenrir' | 'Zephyr';
export type HistoryModule = 'explain' | 'correctMe' | 'listenToMe';

export interface VoicePersona {
  voiceId: VoiceOption;
  customName: string;
}

export interface HistoryItem {
  id: string;
  title: string;
  type: FileType;
  date: number;
  language: string;
  module: HistoryModule;
  score?: number;
  pdfData?: {
    pageResults: { [page: number]: AnalysisResult };
    lastViewedPage: number;
    totalPages: number;
    completedPages: number[];
  };
  result?: AnalysisResult;
  assessmentResult?: AssessmentResult;
  listenToMeResult?: ListenToMeResult;
}

export interface UserProfile {
  name: string;
  photo: string | null;
  totalAnalyses: number;
  joinedDate: number;
  voicePersonas: VoicePersona[];
}

export type ViewMode = 'dashboard' | 'history' | 'profile' | 'settings' | 'correctMe' | 'listenToMe';

export interface AppState {
  isLoggedIn: boolean;
  view: ViewMode;
  file: File | null;
  fileType: FileType;
  textInput: string;
  pdfDoc: any | null;
  currentPage: number;
  totalPages: number;
  language: string;
  activeVoiceId: VoiceOption;
  isAnalyzing: boolean;
  result: AnalysisResult | null;
  assessmentResult: AssessmentResult | null;
  listenToMeResult: ListenToMeResult | null;
  error: string | null;
  history: HistoryItem[];
  activeHistoryId: string | null;
  profile: UserProfile;
}

export const LANGUAGES = [
  { code: 'English', name: 'English' },
  { code: 'Telugu', name: 'తెలుగు (Telugu)' },
  { code: 'Spanish', name: 'Español' },
  { code: 'French', name: 'Français' },
  { code: 'German', name: 'Deutsch' },
  { code: 'Chinese', name: '中文' },
  { code: 'Japanese', name: '日本語' },
  { code: 'Hindi', name: 'हिन्दी' },
  { code: 'Portuguese', name: 'Português' },
  { code: 'Arabic', name: 'العربية' }
];

export const BASE_VOICES: { id: VoiceOption; label: string; description: string }[] = [
  { id: 'Kore', label: 'Female Soft', description: 'Calm and steady narrator' },
  { id: 'Charon', label: 'Male Deep', description: 'Authoritative teacher tone' },
  { id: 'Puck', label: 'Youthful', description: 'Energetic and friendly' },
  { id: 'Zephyr', label: 'Neutral Professional', description: 'Clear and concise delivery' },
  { id: 'Fenrir', label: 'Warm', description: 'Comforting storytelling voice' }
];

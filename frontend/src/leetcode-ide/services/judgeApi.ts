import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export type RunResult = {
  status: "OK" | "ERROR";
  testResults: {
    input: string;
    expected: string;
    actual: string;
    passed: boolean;
    timeMs?: number; // Added to match backend response
    error?: string;  // Added to match backend catch block
  }[];
};

export type SubmitResult = {
  status:
    | "Accepted"
    | "Wrong Answer"
    | "Runtime Error"
    | "Time Limit Exceeded"
    | "Compilation Error";
  passedCount: number;
  totalCount: number;
  timeMs: number;
  memoryMb: number;
};

// Updated to include testCases array required by judge.service.ts
export const runCode = (payload: {
  questionId: string;
  language: string;
  code: string;
  testCases: { input: string; output: string }[]; 
}) =>
  axios.post<RunResult>(`${API_BASE}/api/judge/run`, payload);

export const submitCode = (payload: {
  questionId: string;
  language: string;
  code: string;
}) =>
  axios.post<SubmitResult>(`${API_BASE}/api/judge/submit`, payload);
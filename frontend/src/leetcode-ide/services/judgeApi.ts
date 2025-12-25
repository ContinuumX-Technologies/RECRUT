import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export type RunResult = {
  status: "OK" | "ERROR";
  testResults: {
    input: string;
    expected: string;
    actual: string;
    passed: boolean;
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

export const runCode = (payload: {
  questionId: string;
  language: string;
  code: string;
}) =>
  axios.post<RunResult>(`${API_BASE}/api/judge/run`, payload);

export const submitCode = (payload: {
  questionId: string;
  language: string;
  code: string;
}) =>
  axios.post<SubmitResult>(`${API_BASE}/api/judge/submit`, payload);

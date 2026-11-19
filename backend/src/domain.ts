export type Admin = { id: string; email: string; passwordHash: string };
export type Option = { id: string; text: string; isCorrect: boolean };
export type Question = {
  id: string;
  quizId: string;
  text: string;
  order: number;
  timeLimitSecs: number;
  options: Option[];
};
export type Quiz = {
  id: string;
  title: string;
  description?: string | null;
  isPublished: boolean;
  hostId: string;
  questions: Question[];
};

export interface Repository {
  findAdminByEmail(email: string): Promise<Admin | null>;
  listQuizzes(hostId: string): Promise<Quiz[]>;
  getQuiz(id: string, hostId: string): Promise<Quiz | null>;
  createQuiz(input: { title: string; description?: string; hostId: string }): Promise<Quiz>;
  updateQuiz(id: string, hostId: string, input: { title?: string; description?: string; isPublished?: boolean }): Promise<Quiz | null>;
  deleteQuiz(id: string, hostId: string): Promise<boolean>;
  createQuestion(input: {
    quizId: string;
    text: string;
    order: number;
    timeLimitSecs?: number;
    options: Array<{ text: string; isCorrect: boolean }>;
  }): Promise<Question | null>;
  saveQuiz(input: {
    quizId?: string;
    hostId: string;
    title: string;
    description?: string;
    isPublished: boolean;
    questions: Array<{
      text: string;
      order: number;
      timeLimitSecs: number;
      options: Array<{ text: string; isCorrect: boolean }>;
    }>;
  }): Promise<Quiz>;
}

export type Admin = { id: string; email: string; passwordHash: string };
export type Option = { id: string; text: string; isCorrect: boolean };
export type Question = {
  id: string;
  quizId: string;
  text: string;
  order: number;
  timeLimitSecs: number;
  options: Option[];
  type?: string;
  code?: string | null;
  language?: string | null;
  pictureUrls?: string[] | null;
  word?: string | null;
  imageUrl?: string | null;
  /** 0 = no points, 1 = standard, 2 = double; null/undefined = 1 */
  points?: number | null;
};
export type Quiz = {
  id: string;
  title: string;
  description?: string | null;
  topic?: string | null;
  isPublished: boolean;
  /** false: the host presses Next after the results and the leaderboard; undefined = true */
  autoAdvance?: boolean;
  hostId: string;
  questions: Question[];
};

export type PublicQuiz = { id: string; title: string; description: string | null; topic: string | null; questionCount: number };

export interface Repository {
  findAdminByEmail(email: string): Promise<Admin | null>;
  createAdmin(email: string, passwordHash: string): Promise<Admin>;
  setAdminPassword(id: string, passwordHash: string): Promise<void>;
  listQuizzes(hostId: string): Promise<Quiz[]>;
  /** Published quizzes for the public home page: metadata only, never questions or answers. */
  listPublishedQuizzes(): Promise<PublicQuiz[]>;
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
    topic?: string;
    isPublished: boolean;
    autoAdvance?: boolean;
    questions: SaveQuestionInput[];
  }): Promise<Quiz>;
}

export type SaveQuestionInput = {
  text: string;
  order: number;
  timeLimitSecs: number;
  options: Array<{ text: string; isCorrect: boolean }>;
  type?: string;
  code?: string;
  language?: string;
  pictureUrls?: string[];
  word?: string;
  imageUrl?: string | null;
  points?: number;
};

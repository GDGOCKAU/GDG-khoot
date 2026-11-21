// The front end's CSV import/export (src/lib/csvQuiz.js): right answers per type, export -> import round trip,
// and rows the server would refuse are reported instead of being saved.
import { describe, expect, it } from "vitest";
import { importQuizCSV, quizToCSV, toCSV, LIMITS } from "../../src/lib/csvQuiz.js";

const HEAD = ["Question", "Type", "Answer A", "Answer B", "Answer C", "Answer D", "Correct", "Time", "Points", "Code", "Language", "Word", "Image"];
const sheet = (...rows) => toCSV([["Title", "Sheet"], [], HEAD, ...rows]);
const one = (row) => importQuizCSV(sheet(row)).items[0];

describe("CSV import: the right answer for each type", () => {
  it("multiple choice: a letter, a number, 'Answer 2' or the answer text", () => {
    const row = (correct) => ["Capital?", "mc", "Riyadh", "Jeddah", "Paris", "", correct, "20", "1"];
    expect(one(row("b")).q.correct).toBe(1);
    expect(one(row("3")).q.correct).toBe(2);
    expect(one(row("Answer 2")).q.correct).toBe(1);
    expect(one(row("paris")).q.correct).toBe(2);
    const wrong = one(row("Z"));
    expect(wrong.q.correct).toBe(-1);
    expect(wrong.problem).toBe("needs a correct answer");
  });
  it("true/false: True/False, صح/خطأ, a/b", () => {
    const row = (correct) => ["Dart is typed", "tf", "", "", "", "", correct, "15", "1"];
    for (const [c, idx] of [["True", 0], ["false", 1], ["صح", 0], ["خطأ", 1], ["b", 1]]) expect(one(row(c)).q.correct).toBe(idx);
    expect(one(row("True")).q.answers).toEqual(["True", "False", "", ""]);
  });
  it("code: options and the right one, code with line breaks kept", () => {
    const q = one(["What prints?", "code", "5", "23", "", "", "A", "30", "1", "void main() {\n  print(2 + 3);\n}", "Dart"]).q;
    expect(q).toMatchObject({ type: "code", correct: 0, lang: "Dart", code: "void main() {\n  print(2 + 3);\n}" });
    expect(one(["Hand typed", "code", "1", "2", "", "", "a", "30", "1", "print(1)\\nprint(2)", "Python"]).q.code).toBe("print(1)\nprint(2)");
  });
});

describe("CSV import: rows the server would refuse", () => {
  it("snaps times to the allowed values and says so", () => {
    const x = one(["Q", "mc", "A", "B", "", "", "A", "45", "1"]);
    expect([5, 10, 15, 20, 30, 60]).toContain(x.q.time);
    expect(x.notes.join()).toMatch(/time 45 s changed/);
  });
  it("marks too-long text, answers and words, without throwing", () => {
    expect(one(["x".repeat(LIMITS.text + 1), "mc", "A", "B", "", "", "A", "20", "1"]).limit).toMatch(/question is 161 characters/);
    expect(one(["Q", "mc", "A", "y".repeat(LIMITS.answer + 1), "", "", "A", "20", "1"]).limit).toMatch(/answer B/);
    expect(one(["Q", "pic", "", "", "", "", "", "30", "1", "", "", "A".repeat(21)]).limit).toMatch(/word is 21 letters/);
    expect(one(["Fine", "mc", "A", "B", "", "", "A", "20", "1"]).limit).toBe("");
  });
  it("reads odd input without crashing", () => {
    expect(importQuizCSV("").items).toEqual([]);
    expect(importQuizCSV("\u0000\u0001PK\u0003garbage,,,\n\"unclosed").items.length).toBeGreaterThanOrEqual(0);
    expect(() => importQuizCSV("a;b;c\n".repeat(5000))).not.toThrow();
  });
});

describe("CSV export -> import gives the same quiz", () => {
  it("round-trips every type, points (0/1/2), times, code, word and pictures", () => {
    const quiz = {
      title: "Round trip", topic: "Cloud", desc: "Export then import",
      questions: [
        { type: "mc", text: "Which company makes Flutter?", answers: ["Google", "Apple", "Meta", ""], correct: 0, time: 20, points: 2, img: "http://192.168.1.5:5173/uploads/11111111-1111-4111-8111-111111111111.jpg" },
        { type: "tf", text: "Dart is compiled, \"really\".", answers: ["True", "False", "", ""], correct: 1, time: 10, points: 1 },
        { type: "code", text: "What prints?", answers: ["a\\nb", "ab", "", ""], correct: 0, time: 60, points: 0, code: "void main() {\n  print('a\\nb');\n}", lang: "Python" },
        { type: "pic", text: "Put them together", answers: ["", "", "", ""], correct: -1, time: 30, points: 1, word: "DOORMAN", pics: ["/uploads/a.png", "https://example.com/b.png"] },
      ],
    };
    const back = importQuizCSV(quizToCSV(quiz), "x.csv");
    expect(back.meta).toEqual({ title: "Round trip", topic: "Cloud", desc: "Export then import" });
    expect(back.items).toHaveLength(4);
    back.items.forEach((item, i) => {
      const a = quiz.questions[i], b = item.q;
      expect(b.type).toBe(a.type);
      expect(b.text).toBe(a.text);
      expect(b.correct).toBe(a.correct);
      expect(b.time).toBe(a.time);
      expect(b.points).toBe(a.points);
      if (a.type !== "pic") expect(b.answers).toEqual(a.answers);
      expect(item.limit).toBe("");
      expect(item.notes).toEqual([]);
    });
    expect(back.items[0].q.img).toBe(quiz.questions[0].img);
    expect(back.items[2].q).toMatchObject({ code: quiz.questions[2].code, lang: "Python" });
    expect(back.items[3].q).toMatchObject({ word: "DOORMAN", pics: quiz.questions[3].pics });
  });
});

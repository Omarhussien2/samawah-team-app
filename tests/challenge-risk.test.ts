import { describe, expect, it } from "vitest";
import { calculateRiskCoverage, calculateRiskScore, getRiskLevel, summarizeChallenges } from "../lib/challenges/risk";

describe("challenge risk helpers", () => {
  it("calculates the matrix score from probability and impact", () => {
    expect(calculateRiskScore(4, 5)).toBe(20);
    expect(calculateRiskScore(0, 10)).toBe(5);
  });

  it("maps scores into operational risk levels", () => {
    expect(getRiskLevel(4)).toBe("low");
    expect(getRiskLevel(8)).toBe("medium");
    expect(getRiskLevel(15)).toBe("high");
    expect(getRiskLevel(25)).toBe("critical");
  });

  it("summarizes open and critical challenges for project indicators", () => {
    const summary = summarizeChallenges([
      challenge("open", 5, 5),
      challenge("in_progress", 3, 4),
      challenge("resolved", 5, 5),
    ]);

    expect(summary).toMatchObject({
      total: 3,
      open: 2,
      critical: 1,
      averageRiskScore: 19,
      riskCoverage: 50,
    });
  });

  it("treats projects with no open risks as fully covered", () => {
    expect(calculateRiskCoverage([challenge("resolved", 5, 5)])).toBe(100);
  });
});

function challenge(status: "open" | "in_progress" | "resolved" | "closed", probability: number, impact: number) {
  return {
    status,
    probability_score: probability,
    impact_score: impact,
    risk_score: probability * impact,
    risk_level: getRiskLevel(probability * impact),
  };
}

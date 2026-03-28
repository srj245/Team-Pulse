# Core Features

ValidationEngine is built on four core pillars:

## 1. Research Engine
Instead of relying on an LLM's hallucinated knowledge cutoff, the Research Engine fetches **live** competitor data using API layers like SerpApi and Tavily.
- Displays competitor positioning and active pricing structures.
- Gives you direct links to competitor websites.

## 2. Dynamic Landing Page Generator
Building a React landing page takes hours. The generator constructs a highly optimized waitlist website with a unique identifier in seconds. It handles Form Actions and UX natively. 

## 3. Decision Engine
The Decision Engine acts as your automated Y-Combinator partner. It parses waitlist analytics and assesses statistical significance.
- Automatically calculates `conversionRate`.
- Evaluates `interviewRequests` (a strong signal of user friction point).
- Provides actionable feedback: Suggests why users didn't respond or tells you what to optimize next.

## 4. Hypothesis Engine
An automated framework constructor that parses your 2-sentence idea into a Y-Combinator standard format:
- **Target User:** Who experiences the pain.
- **Problem Statement:** The specific gap in the current workflow.
- **Value Proposition:** The solution.
- **Evidence Summary:** What proof is needed to validate this.

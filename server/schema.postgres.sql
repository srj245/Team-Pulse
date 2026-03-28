CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL,
  normalized_text TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ideas_user_id_created_at ON ideas(user_id, created_at DESC);
CREATE INDEX idx_ideas_status ON ideas(status);

CREATE TABLE research_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  query_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_research_runs_idea_id ON research_runs(idea_id, created_at DESC);

CREATE TABLE research_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_run_id UUID NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  source_domain TEXT NOT NULL,
  source_title TEXT NOT NULL,
  source_snippet TEXT NOT NULL,
  competitor_name TEXT,
  pricing_summary TEXT,
  positioning_summary TEXT,
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_research_sources_idea_id ON research_sources(idea_id, created_at DESC);
CREATE INDEX idx_research_sources_run_id ON research_sources(research_run_id);
CREATE INDEX idx_research_sources_domain ON research_sources(source_domain);

CREATE TABLE hypotheses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  target_user TEXT NOT NULL,
  problem_statement TEXT NOT NULL,
  value_proposition TEXT NOT NULL,
  testable_hypothesis TEXT NOT NULL,
  success_metric TEXT NOT NULL,
  supporting_research_run_id UUID REFERENCES research_runs(id) ON DELETE SET NULL,
  model_name TEXT,
  prompt_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (idea_id, version)
);

CREATE INDEX idx_hypotheses_idea_id_version ON hypotheses(idea_id, version DESC);

CREATE TABLE experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  hypothesis_id UUID REFERENCES hypotheses(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  public_slug TEXT NOT NULL UNIQUE,
  deployed_url TEXT,
  deployment_provider TEXT,
  deployment_status TEXT NOT NULL DEFAULT 'pending',
  launched_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_experiments_idea_id ON experiments(idea_id, created_at DESC);
CREATE INDEX idx_experiments_public_slug ON experiments(public_slug);

CREATE TABLE landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  headline TEXT NOT NULL,
  subheadline TEXT NOT NULL,
  cta_text TEXT NOT NULL,
  page_schema JSONB NOT NULL,
  rendered_html TEXT,
  asset_manifest JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (experiment_id, version)
);

CREATE INDEX idx_landing_pages_experiment_id_version ON landing_pages(experiment_id, version DESC);

CREATE TABLE event_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  anonymous_id TEXT NOT NULL,
  ip_hash TEXT,
  user_agent_hash TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  UNIQUE (experiment_id, anonymous_id)
);

CREATE INDEX idx_event_sessions_experiment_id ON event_sessions(experiment_id);

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  session_id UUID REFERENCES event_sessions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  path TEXT,
  referrer TEXT,
  metadata JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_experiment_id_occurred_at ON events(experiment_id, occurred_at DESC);
CREATE INDEX idx_events_event_type ON events(event_type);

CREATE TABLE waitlist_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT,
  interview_requested BOOLEAN NOT NULL DEFAULT FALSE,
  source_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (experiment_id, email)
);

CREATE INDEX idx_waitlist_signups_experiment_id_created_at ON waitlist_signups(experiment_id, created_at DESC);

CREATE TABLE decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  decision_status TEXT NOT NULL,
  confidence TEXT NOT NULL,
  rule_snapshot JSONB NOT NULL,
  metrics_snapshot JSONB NOT NULL,
  ai_explanation JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_decisions_experiment_id_created_at ON decisions(experiment_id, created_at DESC);

CREATE TABLE experiment_daily_metrics (
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  page_views INTEGER NOT NULL DEFAULT 0,
  signups INTEGER NOT NULL DEFAULT 0,
  interview_requests INTEGER NOT NULL DEFAULT 0,
  conversion_rate NUMERIC(6,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (experiment_id, metric_date)
);

CREATE INDEX idx_experiment_daily_metrics_date ON experiment_daily_metrics(metric_date DESC);

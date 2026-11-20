import React, { useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  Play,
  X,
} from 'lucide-react';
import { ONBOARDING_STEPS, type OnboardingStep } from '../services/guestSession';
import type { NavPageId } from './Sidebar';

interface OnboardingTourModalProps {
  open: boolean;
  stepIndex: number;
  onChangeStep: (index: number) => void;
  onNavigatePreview: (page: NavPageId) => void;
  onSkip: () => void;
  onComplete: () => void;
  onCompleteAndLaunchDemo: () => void;
  demoLoading: boolean;
}

export const OnboardingTourModal: React.FC<OnboardingTourModalProps> = ({
  open,
  stepIndex,
  onChangeStep,
  onNavigatePreview,
  onSkip,
  onComplete,
  onCompleteAndLaunchDemo,
  demoLoading,
}) => {
  const totalSteps = ONBOARDING_STEPS.length;
  const clampedIndex = Math.max(0, Math.min(stepIndex, totalSteps - 1));
  const step: OnboardingStep = ONBOARDING_STEPS[clampedIndex];
  const isFirst = clampedIndex === 0;
  const isLast = clampedIndex === totalSteps - 1;
  const progressPercent = Math.round(((clampedIndex + 1) / totalSteps) * 100);

  // Sync background workspace preview to match the active tour step
  useEffect(() => {
    if (!open) return;
    onNavigatePreview(step.targetPage);
  }, [open, step.targetPage, onNavigatePreview]);

  // Keyboard shortcuts: Escape to skip, Left/Right arrows to step
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onSkip();
      } else if (event.key === 'ArrowRight' && clampedIndex < totalSteps - 1) {
        event.preventDefault();
        onChangeStep(clampedIndex + 1);
      } else if (event.key === 'ArrowLeft' && clampedIndex > 0) {
        event.preventDefault();
        onChangeStep(clampedIndex - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, clampedIndex, totalSteps, onChangeStep, onSkip]);

  if (!open) return null;

  return (
    <div
      data-testid="onboarding-tour-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-step-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-xs"
        onClick={onSkip}
        aria-hidden="true"
      />

      {/* Modal Surface */}
      <div
        className="relative z-10 w-full max-w-2xl rounded-xl border overflow-hidden shadow-2xl"
        style={{
          backgroundColor: 'var(--surface-card)',
          borderColor: 'var(--border-strong)',
          color: 'var(--text-primary)',
        }}
      >
        {/* Top Progress Bar */}
        <div
          className="h-1 w-full"
          style={{ backgroundColor: 'var(--surface-subtle)' }}
          aria-hidden="true"
        >
          <div
            className="h-full transition-[width] duration-200"
            style={{
              width: `${progressPercent}%`,
              backgroundColor: 'var(--accent-primary)',
            }}
          />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 border-b"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Compass
              className="h-4 w-4 shrink-0"
              style={{ color: 'var(--accent-text)' }}
              aria-hidden="true"
            />
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent-text)] whitespace-nowrap">
              Guided Tour
            </span>
            <span className="text-[var(--text-muted)] text-xs" aria-hidden="true">
              ·
            </span>
            <span
              data-testid="tour-step-counter"
              className="font-mono text-xs tabular-nums text-[var(--text-muted)] whitespace-nowrap"
            >
              Step {step.stepNumber} of {totalSteps}
            </span>
          </div>

          <button
            type="button"
            onClick={onSkip}
            aria-label="Skip guided tour"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Interactive Step Indicator Dots/Segments */}
        <div
          className="px-5 sm:px-6 pt-4 flex items-center gap-1.5"
          role="tablist"
          aria-label="Guided tour steps"
        >
          {ONBOARDING_STEPS.map((s, idx) => {
            const active = idx === clampedIndex;
            const visited = idx < clampedIndex;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`Step ${s.stepNumber}: ${s.title}`}
                onClick={() => onChangeStep(idx)}
                className="flex-1 h-1.5 rounded-full transition-colors cursor-pointer"
                style={{
                  backgroundColor: active
                    ? 'var(--accent-primary)'
                    : visited
                      ? 'var(--status-success)'
                      : 'var(--border-strong)',
                  opacity: active ? 1 : visited ? 0.75 : 0.45,
                }}
              />
            );
          })}
        </div>

        {/* Body Content */}
        <div className="px-5 sm:px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <div className="text-xs font-mono text-[var(--text-muted)]">
              Workspace Highlight: <span className="text-[var(--text-secondary)]">{step.workspaceLabel}</span>
            </div>
            <h2
              id="onboarding-step-title"
              className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]"
            >
              {step.title}
            </h2>
            <p className="text-xs sm:text-sm font-medium text-[var(--accent-text)]">
              {step.subtitle}
            </p>
          </div>

          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            {step.description}
          </p>

          <ul className="space-y-2.5 pt-1">
            {step.highlights.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 text-xs sm:text-[13px] text-[var(--text-secondary)] leading-relaxed"
              >
                <span
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm font-mono text-[10px] font-bold"
                  style={{
                    backgroundColor: 'var(--accent-soft)',
                    color: 'var(--accent-text)',
                  }}
                  aria-hidden="true"
                >
                  {idx + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer Navigation Controls */}
        <div
          className="px-5 sm:px-6 py-4 border-t flex flex-wrap items-center justify-between gap-3"
          style={{
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--surface-subtle)',
          }}
        >
          <button
            type="button"
            data-testid="tour-skip-btn"
            onClick={onSkip}
            className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer px-2 py-1.5"
          >
            Skip tour
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              data-testid="tour-prev-btn"
              onClick={() => onChangeStep(clampedIndex - 1)}
              disabled={isFirst}
              className="raira-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Previous</span>
            </button>

            {!isLast ? (
              <button
                type="button"
                data-testid="tour-next-btn"
                onClick={() => onChangeStep(clampedIndex + 1)}
                className="raira-btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                <span>Next</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  data-testid="tour-finish-btn"
                  onClick={onComplete}
                  className="raira-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Enter Dashboard</span>
                </button>
                <button
                  type="button"
                  data-testid="tour-launch-demo-btn"
                  onClick={onCompleteAndLaunchDemo}
                  disabled={demoLoading}
                  className="raira-btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{demoLoading ? 'Loading...' : 'Load Demo & Start'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type RefObject } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, ArrowRight, Check, Loader2, Pencil, RotateCw } from "lucide-react";
import posthog from "posthog-js";
import { ApiError } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import {
  CHALLENGES,
  EMPTY_FORM,
  FEATURES,
  FREQUENCIES,
  GOALS,
  LONG_TEXT,
  ROLES,
  SHORT_TEXT,
  labelOf,
  submitFeedback,
  validateStep,
  type Errors,
  type Feature,
  type FeedbackForm as Form,
} from "@/lib/feedback";
import { CheckboxGroup, ChoiceGroup, OtherInput, ScoreScale, StarRating, TextArea, TextField } from "./fields";

const STEPS = [
  { title: "About you", intro: "A little context helps us read your answers. Name and email are optional." },
  { title: "Your experience", intro: "How Rankwise works for you today." },
  { title: "Suggestions", intro: "Anything you'd like to tell us. Every field here is optional." },
] as const;
const REVIEW = STEPS.length;
const DRAFT_KEY = "rw-feedback-draft";
const posthogEnabled = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY && process.env.NEXT_PUBLIC_POSTHOG_HOST);

type Status = "editing" | "submitting" | "failed" | "done";
type Draft = { form: Form; step: number; id: string };

function newId(): string {
  // randomUUID needs a secure context (https or localhost); a LAN IP over http only has getRandomValues
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function readDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    const draft = raw ? (JSON.parse(raw) as Draft) : null;
    return draft?.form && typeof draft.id === "string" ? { ...draft, form: { ...EMPTY_FORM, ...draft.form } } : null;
  } catch {
    return null;
  }
}

function saveDraft(draft: Draft | null) {
  try {
    if (draft) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // private mode or blocked storage: the form still works, answers just don't survive a reload
  }
}

const noSubscribe = () => () => {};

/** Waits for the browser (the draft lives in sessionStorage) and the session check, then starts the form with them. */
export function FeedbackForm() {
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);
  const { data: session, isPending } = authClient.useSession();
  if (!inBrowser || isPending) {
    return (
      <div aria-busy="true" aria-label="Loading the feedback form">
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-1 rounded-full bg-white/[0.08]" />
          ))}
        </div>
        <div className="panel mt-6 h-[560px] animate-pulse rounded-2xl" />
      </div>
    );
  }
  return <Steps account={session?.user ?? null} />;
}

function Steps({ account }: { account: { name?: string | null; email?: string | null } | null }) {
  // an unfinished draft (reload, failed submit) wins; otherwise a signed-in account's name and email, which can be cleared
  const [initial] = useState<Draft>(
    () =>
      readDraft() ?? {
        form: { ...EMPTY_FORM, name: account?.name ?? "", email: account?.email ?? "" },
        step: 0,
        id: newId(),
      },
  );
  const [form, setForm] = useState<Form>(initial.form);
  const [step, setStep] = useState(Math.min(Math.max(initial.step, 0), REVIEW));
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>("editing");
  const [failure, setFailure] = useState("");
  const submissionId = initial.id;
  const heading = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    if (status !== "done") saveDraft({ form, step, id: submissionId });
  }, [form, step, status, submissionId]);

  // move focus to the new step's heading so keyboard and screen-reader users start at the top
  useEffect(() => {
    if (moved.current) heading.current?.focus({ preventScroll: true });
  }, [step, status]);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }

  function setFeatures(next: Feature[]) {
    // "None yet" and real features exclude each other: the newest choice wins
    const added = next.find((v) => !form.features_used.includes(v));
    set("features_used", added === "none_yet" ? ["none_yet"] : next.filter((v) => v !== "none_yet"));
  }

  function focusFirstError(found: Errors) {
    const first = Object.keys(found)[0];
    if (!first) return;
    requestAnimationFrame(() => {
      const el = formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`);
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  function go(next: number) {
    moved.current = true;
    setErrors({});
    setStep(next);
    formRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function next() {
    const found = validateStep(step, form);
    if (Object.keys(found).length) {
      setErrors(found);
      focusFirstError(found);
      return;
    }
    go(step + 1);
  }

  async function submit() {
    if (status === "submitting") return;
    for (let s = 0; s < STEPS.length; s++) {
      const found = validateStep(s, form);
      if (Object.keys(found).length) {
        go(s);
        setErrors(found);
        focusFirstError(found);
        return;
      }
    }
    setStatus("submitting");
    setFailure("");
    try {
      await submitFeedback(form, submissionId);
      if (posthogEnabled) posthog.capture("feedback_submitted");
      saveDraft(null);
      moved.current = true;
      setStatus("done");
    } catch (e) {
      // answers stay as they are; the same submission id is reused, so a retry can't create a duplicate
      setFailure(
        e instanceof ApiError && e.status < 500
          ? e.message
          : "We couldn't save your feedback. Your answers are still here, so you can try again.",
      );
      setStatus("failed");
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (step < REVIEW) next();
    else void submit();
  }

  if (status === "done") return <Thanks headingRef={heading} />;

  const submitting = status === "submitting";
  const current = step < REVIEW ? STEPS[step] : { title: "Review and send", intro: "Check your answers. You can edit any section before sending." };
  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <div>
      <Progress step={step} />

      <form ref={formRef} onSubmit={onSubmit} noValidate aria-labelledby="fb-step-title" className="panel mt-6 scroll-mt-28 rounded-2xl p-5 sm:p-8">
        <h2 id="fb-step-title" ref={heading} tabIndex={-1} className="font-display text-[24px] font-semibold tracking-[-0.02em] outline-none sm:text-[28px]">
          {current.title}
        </h2>
        <p className="mt-1.5 font-sub text-[14.5px] text-ink-3">{current.intro}</p>

        {hasErrors && (
          <p role="alert" className="mt-5 flex items-start gap-2 rounded-lg border border-bad/30 bg-bad-soft px-3.5 py-2.5 font-sub text-[13.5px] text-ink-2">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#f87171]" /> Some answers need a look before you continue.
          </p>
        )}

        <div className="mt-7 space-y-8">
          {step === 0 && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField name="name" label="Name" value={form.name} onChange={(v) => set("name", v)} error={errors.name} autoComplete="name" maxLength={SHORT_TEXT} />
                <TextField name="email" label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} error={errors.email} autoComplete="email" maxLength={254} placeholder="you@company.com" />
              </div>
              <ChoiceGroup name="role" legend="What's your role?" required options={ROLES} value={form.role} onChange={(v) => set("role", v)} error={errors.role}>
                {form.role === "other" && <OtherInput name="role_other" label="Your role" value={form.role_other} onChange={(v) => set("role_other", v)} error={errors.role_other} />}
              </ChoiceGroup>
              <ChoiceGroup name="usage_frequency" legend="How often do you use Rankwise?" required columns={1} options={FREQUENCIES} value={form.usage_frequency} onChange={(v) => set("usage_frequency", v)} error={errors.usage_frequency} />
            </>
          )}

          {step === 1 && (
            <>
              <StarRating name="satisfaction_rating" legend="Overall, how satisfied are you with Rankwise?" low="Very unsatisfied" high="Very satisfied" value={form.satisfaction_rating} onChange={(v) => set("satisfaction_rating", v)} error={errors.satisfaction_rating} />
              <StarRating name="usability_rating" legend="How easy is Rankwise to use?" low="Very hard" high="Very easy" value={form.usability_rating} onChange={(v) => set("usability_rating", v)} error={errors.usability_rating} />
              <ScoreScale name="recommendation_score" legend="How likely are you to recommend Rankwise to a colleague?" value={form.recommendation_score} onChange={(v) => set("recommendation_score", v)} error={errors.recommendation_score} />
              <ChoiceGroup name="primary_goal" legend="What's your main goal with Rankwise?" required options={GOALS} value={form.primary_goal} onChange={(v) => set("primary_goal", v)} error={errors.primary_goal}>
                {form.primary_goal === "other" && <OtherInput name="primary_goal_other" label="Your main goal" value={form.primary_goal_other} onChange={(v) => set("primary_goal_other", v)} error={errors.primary_goal_other} />}
              </ChoiceGroup>
              <CheckboxGroup name="features_used" legend="Which features have you used?" hint="Select all that apply." options={FEATURES} value={form.features_used} onChange={setFeatures} />
              <ChoiceGroup
                name="most_valuable_feature"
                legend="Which feature is most valuable to you?"
                options={FEATURES.filter((o) => o.value !== "none_yet")}
                value={form.most_valuable_feature}
                onChange={(v) => set("most_valuable_feature", v)}
              />
              <ChoiceGroup name="biggest_challenge" legend="What's your biggest challenge with Rankwise?" required options={CHALLENGES} value={form.biggest_challenge} onChange={(v) => set("biggest_challenge", v)} error={errors.biggest_challenge}>
                {form.biggest_challenge === "other" && (
                  <OtherInput name="biggest_challenge_other" label="Your biggest challenge" value={form.biggest_challenge_other} onChange={(v) => set("biggest_challenge_other", v)} error={errors.biggest_challenge_other} />
                )}
              </ChoiceGroup>
            </>
          )}

          {step === 2 && (
            <>
              <TextArea name="positive_feedback" label="What do you like most about Rankwise?" maxLength={LONG_TEXT} value={form.positive_feedback} onChange={(v) => set("positive_feedback", v)} error={errors.positive_feedback} />
              <TextArea name="improvement_suggestions" label="What should we improve?" maxLength={LONG_TEXT} value={form.improvement_suggestions} onChange={(v) => set("improvement_suggestions", v)} error={errors.improvement_suggestions} />
              <TextArea name="requested_feature" label="What feature would you like us to add next?" maxLength={LONG_TEXT} value={form.requested_feature} onChange={(v) => set("requested_feature", v)} error={errors.requested_feature} />
              <TextArea name="additional_comments" label="Anything else?" maxLength={LONG_TEXT} value={form.additional_comments} onChange={(v) => set("additional_comments", v)} error={errors.additional_comments} />
              <div>
                <label className={`flex items-start gap-3 font-sub text-[14.5px] ${form.email.trim() ? "cursor-pointer text-ink-2" : "cursor-not-allowed text-ink-3"}`}>
                  <input
                    type="checkbox"
                    name="contact_permission"
                    checked={form.contact_permission && Boolean(form.email.trim())}
                    disabled={!form.email.trim()}
                    onChange={(e) => set("contact_permission", e.target.checked)}
                    aria-describedby="fb-contact-hint"
                    className="mt-0.5 size-4 shrink-0 accent-[#9333ea]"
                  />
                  <span>You can contact me about this feedback.</span>
                </label>
                <p id="fb-contact-hint" className="ml-7 mt-1 font-sub text-[13px] text-ink-3">
                  {form.email.trim()
                    ? "We'll only use your email to follow up on what you wrote here, never for marketing."
                    : "Add your email in step 1 if you'd like us to follow up."}
                </p>
              </div>
            </>
          )}

          {step === REVIEW && <Review form={form} onEdit={go} />}
        </div>

        {status === "failed" && (
          <div role="alert" className="mt-7 flex flex-col gap-3 rounded-xl border border-bad/30 bg-bad-soft p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 font-sub text-[14px] text-ink-2">
              <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#f87171]" /> {failure}
            </p>
            <button type="button" onClick={() => void submit()} className="btn-ghost inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full px-4 font-sub text-[14px]">
              <RotateCw aria-hidden="true" className="size-4" /> Try again
            </button>
          </div>
        )}

        <div className="mt-9 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          {step > 0 ? (
            <button type="button" onClick={() => go(step - 1)} disabled={submitting} className="btn-ghost inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-5 font-sub text-[14.5px]">
              <ArrowLeft aria-hidden="true" className="size-4" /> Back
            </button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <button type="submit" disabled={submitting} className="btn-brand inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-6 font-sub text-[14.5px] font-medium">
            {step < REVIEW ? (
              <>
                {step === STEPS.length - 1 ? "Review answers" : "Continue"} <ArrowRight aria-hidden="true" className="size-4" />
              </>
            ) : submitting ? (
              <>
                <Loader2 aria-hidden="true" className="size-4 animate-spin" /> Sending…
              </>
            ) : (
              <>
                Send feedback <Check aria-hidden="true" className="size-4" />
              </>
            )}
          </button>
        </div>
        <p aria-live="polite" className="sr-only">
          {submitting ? "Sending your feedback" : ""}
        </p>
      </form>
    </div>
  );
}

function Progress({ step }: { step: number }) {
  const labels = [...STEPS.map((s) => s.title), "Review"];
  return (
    <nav aria-label="Feedback progress">
      <ol className="grid grid-cols-4 gap-2">
        {labels.map((label, i) => {
          const state = i < step ? "done" : i === step ? "current" : "todo";
          return (
            <li key={label} aria-current={state === "current" ? "step" : undefined}>
              <div className={`h-1 rounded-full transition-colors duration-300 ${state === "todo" ? "bg-white/[0.08]" : "bg-cobalt"}`} />
              <p className={`mt-2 flex items-center gap-1.5 font-sub text-[12.5px] sm:text-[13px] ${state === "todo" ? "text-ink-3" : "text-ink"}`}>
                <span className="font-mono text-[11.5px] text-ink-3">{state === "done" ? <Check aria-hidden="true" className="size-3.5 text-cobalt" /> : `0${i + 1}`}</span>
                <span className="truncate">{label}</span>
                <span className="sr-only">{state === "done" ? " (completed)" : state === "todo" ? " (not started)" : ""}</span>
              </p>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Review({ form, onEdit }: { form: Form; onEdit: (step: number) => void }) {
  const other = (value: string, text: string) => (value === "other" ? `Other: ${text.trim()}` : labelOf(value));
  const sections: { title: string; step: number; rows: [string, string][] }[] = [
    {
      title: "About you",
      step: 0,
      rows: [
        ["Name", form.name.trim() || "—"],
        ["Email", form.email.trim() || "—"],
        ["Role", other(form.role, form.role_other)],
        ["Usage", labelOf(form.usage_frequency)],
      ],
    },
    {
      title: "Your experience",
      step: 1,
      rows: [
        ["Satisfaction", `${form.satisfaction_rating ?? "—"} / 5`],
        ["Ease of use", `${form.usability_rating ?? "—"} / 5`],
        ["Likely to recommend", `${form.recommendation_score ?? "—"} / 10`],
        ["Main goal", other(form.primary_goal, form.primary_goal_other)],
        ["Features used", form.features_used.length ? form.features_used.map(labelOf).join(", ") : "—"],
        ["Most valuable", labelOf(form.most_valuable_feature)],
        ["Biggest challenge", other(form.biggest_challenge, form.biggest_challenge_other)],
      ],
    },
    {
      title: "Suggestions",
      step: 2,
      rows: [
        ["Like most", form.positive_feedback.trim() || "—"],
        ["Improve", form.improvement_suggestions.trim() || "—"],
        ["Next feature", form.requested_feature.trim() || "—"],
        ["Anything else", form.additional_comments.trim() || "—"],
        ["Contact me", form.contact_permission && form.email.trim() ? "Yes" : "No"],
      ],
    },
  ];
  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <section key={s.title} aria-label={s.title} className="rounded-xl border border-line p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-sub text-[15px] font-medium text-ink">{s.title}</h3>
            <button type="button" onClick={() => onEdit(s.step)} className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md px-2 font-sub text-[13.5px] text-cobalt hover:text-cobalt-hover">
              <Pencil aria-hidden="true" className="size-3.5" /> Edit <span className="sr-only">{s.title}</span>
            </button>
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-[180px_1fr]">
            {s.rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-sub text-[13px] text-ink-3">{k}</dt>
                <dd className="whitespace-pre-line break-words font-sub text-[14px] text-ink-2">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

function Thanks({ headingRef }: { headingRef: RefObject<HTMLHeadingElement | null> }) {
  const { data: session } = authClient.useSession();
  return (
    <div className="panel rounded-2xl p-8 text-center sm:p-12">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-cobalt-soft">
        <Check aria-hidden="true" className="size-7 text-cobalt" />
      </span>
      <h2 ref={headingRef} tabIndex={-1} className="mt-6 font-display text-[28px] font-semibold tracking-[-0.02em] outline-none">
        Thank you. <span className="text-accent">We read every answer.</span>
      </h2>
      <p className="mx-auto mt-3 max-w-[48ch] font-sub text-[15px] leading-relaxed text-ink-3">
        Your feedback is saved and goes straight to the people building Rankwise. It shapes what we fix and build next.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href={session?.user ? "/app" : "/"} className="btn-brand inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 font-sub text-[14.5px] font-medium">
          {session?.user ? "Back to your dashboard" : "Back to Rankwise"} <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
        {!session?.user && (
          <Link href="/#audit" className="btn-ghost inline-flex h-11 items-center justify-center rounded-full px-6 font-sub text-[14.5px]">
            Run a free audit
          </Link>
        )}
      </div>
    </div>
  );
}

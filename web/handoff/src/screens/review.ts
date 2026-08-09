/**
 * `review` screen (Jobcore P5.S7b).
 *
 * Reached either after a partner-paid job's router skip, or once payment
 * confirms. Captures a 1-5 star rating, an optional free-text comment, and
 * an explicit (default-unchecked) publish-consent checkbox, then submits
 * them and advances to `done`.
 *
 * ACCEPTANCE CRITERION 7: the rendered links/copy/destinations below are
 * byte-identical no matter which rating the customer picks — the rating is
 * captured and submitted, never used to branch what is shown. Do not add
 * any conditional rendering keyed on `selectedRating`.
 *
 * `REVIEW_PLATFORMS` is a static config: no provider/org shape for public
 * review platforms exists yet in `types.ts` (`ProviderSummary` is
 * payment-provider only), so — mirroring the documented-placeholder pattern
 * `api.ts` uses for its endpoint — this is a small static list rather than
 * fetched/derived config.
 */

import type { HandoffJobData } from '../types';

interface ReviewPlatform {
  label: string;
  url: string;
}

const REVIEW_PLATFORMS: ReviewPlatform[] = [
  { label: 'Leave a review on Google', url: 'https://g.page/r/sdassemblypros/review' },
  { label: 'Leave a review on Facebook', url: 'https://facebook.com/sdassemblypros/reviews' },
];

const STAR_COUNT = 5;

export interface ReviewDeps {
  token: string;
  job: HandoffJobData;
  onSubmitted: () => void;
  onError: (message: string) => void;
}

export function renderReview(container: HTMLElement, deps: ReviewDeps): void {
  const { token, job, onSubmitted, onError } = deps;

  container.innerHTML = '';

  const badge = document.createElement('div');
  badge.className = 'state-badge';
  badge.textContent = 'Review';
  container.appendChild(badge);

  const heading = document.createElement('h1');
  heading.textContent = 'How did we do?';
  container.appendChild(heading);

  const intro = document.createElement('p');
  intro.textContent = 'Your feedback helps us improve. This is optional.';
  container.appendChild(intro);

  let selectedRating = 0;

  const stars = document.createElement('div');
  stars.className = 'star-rating';
  container.appendChild(stars);

  const starButtons: HTMLButtonElement[] = [];
  for (let i = 1; i <= STAR_COUNT; i += 1) {
    const star = document.createElement('button');
    star.type = 'button';
    star.className = 'star-button';
    star.textContent = '★';
    star.setAttribute('aria-label', `${i} star${i === 1 ? '' : 's'}`);
    star.addEventListener('click', () => {
      selectedRating = i;
      starButtons.forEach((b, idx) => {
        b.classList.toggle('star-button-selected', idx < selectedRating);
      });
    });
    starButtons.push(star);
    stars.appendChild(star);
  }

  const commentLabel = document.createElement('label');
  commentLabel.className = 'review-comment-label';
  commentLabel.textContent = 'Comments (optional)';
  container.appendChild(commentLabel);

  const comment = document.createElement('textarea');
  comment.className = 'review-comment';
  commentLabel.appendChild(comment);

  const consentLabel = document.createElement('label');
  consentLabel.className = 'review-consent-label';
  container.appendChild(consentLabel);

  const consent = document.createElement('input');
  consent.type = 'checkbox';
  consent.checked = false;
  consentLabel.appendChild(consent);
  consentLabel.appendChild(document.createTextNode(' You may publish this review publicly.'));

  const submit = document.createElement('button');
  submit.type = 'button';
  submit.className = 'review-submit-button';
  submit.textContent = 'Submit';
  submit.addEventListener('click', () => {
    void handleSubmit(token, job, selectedRating, comment.value, consent.checked, submit, onSubmitted, onError);
  });
  container.appendChild(submit);

  const platformsHeading = document.createElement('h2');
  platformsHeading.textContent = 'Prefer to leave a public review?';
  container.appendChild(platformsHeading);

  const platformsList = document.createElement('div');
  platformsList.className = 'review-platform-list';
  container.appendChild(platformsList);

  for (const platform of REVIEW_PLATFORMS) {
    const link = document.createElement('a');
    link.href = platform.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'review-platform-link';
    link.textContent = platform.label;
    platformsList.appendChild(link);
  }
}

async function handleSubmit(
  token: string,
  job: HandoffJobData,
  rating: number,
  body: string,
  publishOk: boolean,
  submit: HTMLButtonElement,
  onSubmitted: () => void,
  onError: (message: string) => void,
): Promise<void> {
  submit.setAttribute('disabled', 'true');

  try {
    const res = await fetch(`/api/handoff/${encodeURIComponent(token)}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: job.jobId,
        rating,
        body,
        publish_ok: publishOk,
      }),
    });
    if (!res.ok) {
      throw new Error(`submitReview: request failed (${res.status})`);
    }
    onSubmitted();
  } catch (err) {
    submit.removeAttribute('disabled');
    onError(err instanceof Error ? err.message : 'Unable to submit your review.');
  }
}

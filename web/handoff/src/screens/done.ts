/**
 * `done` screen (Jobcore P5.S7b).
 *
 * Terminal state after a review is submitted (or skipped by the caller).
 * Thank-you message plus static business contact details — `HandoffJobData`
 * (types.ts) carries no business-contact fields, so this mirrors the
 * `review.ts` `REVIEW_PLATFORMS` pattern: a small static config rather than
 * job-derived data.
 */

const BUSINESS_CONTACT = {
  name: 'SD Assembly Pros',
  phone: '(619) 555-0100',
  email: 'support@sdassemblypros.com',
};

export function renderDone(container: HTMLElement): void {
  container.innerHTML = '';

  const badge = document.createElement('div');
  badge.className = 'state-badge';
  badge.textContent = 'Done';
  container.appendChild(badge);

  const heading = document.createElement('h1');
  heading.textContent = 'Thank you!';
  container.appendChild(heading);

  const body = document.createElement('p');
  body.textContent = 'Your job is complete and your feedback has been received. We appreciate your business.';
  container.appendChild(body);

  const contactHeading = document.createElement('h2');
  contactHeading.textContent = 'Questions? Contact us';
  container.appendChild(contactHeading);

  const contact = document.createElement('div');
  contact.className = 'business-contact';
  container.appendChild(contact);

  const contactName = document.createElement('p');
  contactName.textContent = BUSINESS_CONTACT.name;
  contact.appendChild(contactName);

  const contactPhone = document.createElement('p');
  contactPhone.textContent = BUSINESS_CONTACT.phone;
  contact.appendChild(contactPhone);

  const contactEmail = document.createElement('p');
  contactEmail.textContent = BUSINESS_CONTACT.email;
  contact.appendChild(contactEmail);
}

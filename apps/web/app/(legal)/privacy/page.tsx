import type { Metadata } from 'next';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Privacy Policy · GHOR' };

// Content must stay in sync with what apps/api actually stores (root CLAUDE.md §6) —
// Play Store's Data Safety form is checked against this page.
export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="meta">Last updated {LEGAL.lastUpdated}</p>

      <p>
        GHOR (&ldquo;we&rdquo;, &ldquo;us&rdquo;) helps people in Assam find rooms and flats
        directly from owners. This policy explains what we collect when you use the GHOR app
        or ghor.co.in, why, and what you can do about it. It is operated by {LEGAL.operator}.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> your phone number (or Google account ID if you sign
          in with Google), your name, and whether you use GHOR as a seeker or an owner.
        </li>
        <li>
          <strong>Listings:</strong> if you are an owner, the details and photos you post,
          including the locality of the property. We convert the locality into approximate map
          coordinates.
        </li>
        <li>
          <strong>Messages:</strong> chats between you and other users, so that both of you
          can see the conversation.
        </li>
        <li>
          <strong>Reviews and reports</strong> you submit about listings.
        </li>
        <li>
          <strong>Device and usage data:</strong> a push notification token for your device,
          when you were last active, and basic in-app events (for example, that a listing was
          viewed or a chat was started) that help us understand whether GHOR is working.
        </li>
        <li>
          <strong>Identity documents</strong>, only if you choose to verify your identity as an
          owner. These are visible only to GHOR administrators and are never shown to other
          users.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run your account, show listings, and deliver messages and notifications.</li>
        <li>
          To keep GHOR trustworthy: every listing is reviewed before it goes live, and reported
          listings and users are reviewed by us.
        </li>
        <li>To show trust signals such as &ldquo;Phone verified&rdquo; and response rate.</li>
        <li>To measure and improve the product.</li>
      </ul>
      <p>We do not sell your personal data.</p>

      <h2>What other users can see</h2>
      <p>
        Other signed-in users can see your name, your verification badges, when you were last
        active, and any listings or reviews you publish. An owner&rsquo;s phone number is shown
        to seekers who choose to call about a listing.
      </p>

      <h2>Service providers</h2>
      <p>
        We use trusted providers to run GHOR: cloud hosting and database services, Cloudinary
        (listing photos), Expo (push notifications), Google (sign-in, and ads in the mobile
        app via Google AdMob), and an SMS provider (login codes). They process data only to
        provide these services to us.
      </p>

      <h2>Keeping and deleting your data</h2>
      <p>
        We keep your data while your account is active. You can delete your account at any
        time from <strong>Profile &rarr; Delete account</strong> in the app or on the website.
        This permanently deletes your profile, listings, conversations and messages, reviews,
        reports, and notifications. Usage events are kept only in anonymised form.
      </p>

      <h2>Your rights</h2>
      <p>
        Under India&rsquo;s Digital Personal Data Protection Act, 2023 you may ask to access,
        correct, or erase your personal data, and raise a grievance with us. Write to{' '}
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
      </p>

      <h2>Grievance officer</h2>
      <p>
        {LEGAL.grievanceOfficer}. Contact:{' '}
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
      </p>

      <h2>Children</h2>
      <p>GHOR is not intended for anyone under 18.</p>

      <h2>Changes</h2>
      <p>
        If we change this policy we will update the date above, and tell you in the app if the
        change is significant.
      </p>
    </>
  );
}

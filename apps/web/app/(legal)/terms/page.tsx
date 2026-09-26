import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Terms of Service · GHOR' };

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="meta">Last updated {LEGAL.lastUpdated}</p>

      <p>
        These terms apply when you use the GHOR app or ghor.co.in, operated by{' '}
        {LEGAL.operator}. By creating an account you agree to them.
      </p>

      <h2>What GHOR is</h2>
      <p>
        GHOR is a platform that connects people looking for rooms and flats with property
        owners. GHOR is not a broker, agent, or party to any rental agreement. Any agreement,
        payment, or deposit is between the seeker and the owner.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must be at least 18 years old.</li>
        <li>Provide accurate information and keep your login secure.</li>
        <li>One person, one account. Do not impersonate anyone.</li>
      </ul>

      <h2>Owners and listings</h2>
      <ul>
        <li>Only list properties you own or are authorised to rent out.</li>
        <li>
          Listings must be accurate: real photos, real rent, real availability. Mark a listing
          as rented once it is no longer available.
        </li>
        <li>
          Every listing is reviewed before it is published. We may reject, hide, or remove any
          listing at our discretion.
        </li>
        <li>Discovery and contact through GHOR are free for seekers.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>post fake, misleading, or duplicate listings;</li>
        <li>harass, threaten, or discriminate against other users;</li>
        <li>spam, or use GHOR to collect other users&rsquo; contact details;</li>
        <li>request payment before a seeker has seen the property;</li>
        <li>interfere with the service or access it by automated means.</li>
      </ul>
      <p>
        You can report a listing from its page. We may suspend or remove accounts that break
        these rules.
      </p>

      <h2>Reviews</h2>
      <p>
        Reviews must reflect your genuine experience. We may hide reviews that are abusive,
        irrelevant, or fake.
      </p>

      <h2>Ads</h2>
      <p>The mobile app may show advertisements, including before contacting an owner.</p>

      <h2>Disclaimer</h2>
      <p>
        We work to keep GHOR trustworthy, but we cannot guarantee that every listing or user is
        genuine. Visit a property and verify details before paying anything. To the extent the
        law allows, GHOR is not liable for losses arising from dealings between users.
      </p>

      <h2>Deleting your account</h2>
      <p>
        You can delete your account at any time from Profile &rarr; Delete account. See the{' '}
        <Link href="/privacy">Privacy Policy</Link> for what is deleted.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of India. Courts in Guwahati, Assam have
        jurisdiction.
      </p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
      </p>
    </>
  );
}

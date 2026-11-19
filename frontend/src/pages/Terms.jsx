import { FileText } from 'lucide-react'

export const TERMS_VERSION = '1.0'
export const TERMS_DATE = 'November 2026'

export function TermsContent() {
  return (
    <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">

      <p className="text-sm text-gray-500 mb-6">
        Last updated: {TERMS_DATE} · Version {TERMS_VERSION}
      </p>

      <p>
        These Terms of Service ("Agreement") constitute a legally binding contract between
        <strong> [COMPANY NAME]</strong> ("Company", "we", "us", "our"), the provider of the
        CheesePOS software-as-a-service platform, and the entity or individual ("Customer", "you")
        that accesses or uses the CheesePOS platform. By accepting this Agreement, creating an
        account, or using the Service, you agree to be bound by these terms in their entirety.
      </p>

      <hr className="my-6 border-gray-200" />

      {/* 1 */}
      <h2 className="text-base font-bold text-gray-900 mt-6 mb-2">1. Definitions</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>"Service"</strong> means the CheesePOS web application, APIs, and related services.</li>
        <li><strong>"Subscription"</strong> means the paid or trial plan under which you access the Service.</li>
        <li><strong>"Tenant"</strong> means the business account created for the Customer on the platform.</li>
        <li><strong>"Users"</strong> means individuals authorised by the Customer to use the Service under the Customer's account.</li>
        <li><strong>"Customer Data"</strong> means all data, records, and content submitted to the Service by the Customer or its Users.</li>
        <li><strong>"Confidential Information"</strong> means non-public business or technical information disclosed between the parties.</li>
      </ul>

      {/* 2 */}
      <h2 className="text-base font-bold text-gray-900 mt-6 mb-2">2. Access & Licence</h2>
      <p>
        Subject to full compliance with this Agreement and timely payment of applicable fees,
        the Company grants the Customer a limited, non-exclusive, non-transferable, revocable
        licence to access and use the Service solely for the Customer's internal business operations
        during the Subscription term.
      </p>
      <p className="mt-2">
        You may not sublicence, resell, or provide access to the Service to any third party
        without the Company's prior written consent. All rights not expressly granted are reserved.
      </p>

      {/* 3 */}
      <h2 className="text-base font-bold text-gray-900 mt-6 mb-2">3. Account Registration & Security</h2>
      <p>
        You must provide accurate, complete, and current information when creating your account.
        You are responsible for safeguarding your login credentials and for all activities that
        occur under your account. Notify us immediately at <strong>[SUPPORT EMAIL]</strong> if
        you suspect any unauthorised access.
      </p>
      <p className="mt-2">
        The Company reserves the right to suspend or terminate any account found to be in
        violation of these terms or engaged in fraudulent activity.
      </p>

      {/* 4 */}
      <h2 className="text-base font-bold text-gray-900 mt-6 mb-2">4. Subscription Plans & Payment</h2>
      <p>
        The Service is offered under a trial period followed by paid subscription plans as
        communicated by the Company at the time of onboarding or renewal. Pricing, billing
        cycles, and plan features are subject to change with 30 days' notice.
      </p>
      <ul className="list-disc pl-5 space-y-1 mt-2">
        <li>All fees are quoted in Indian Rupees (INR) unless stated otherwise.</li>
        <li>Subscription fees are non-refundable except as stated in Section 10 (Termination).</li>
        <li>Failure to pay fees may result in suspension or termination of access.</li>
        <li>Taxes (GST or applicable levies) are not included in quoted prices and will be charged additionally as required by law.</li>
      </ul>

      {/* 5 */}
      <h2 className="text-base font-bold text-gray-900 mt-6 mb-2">5. Customer Data & Privacy</h2>
      <p>
        You retain full ownership of all Customer Data. By using the Service, you grant
        the Company a limited licence to process and store Customer Data solely to provide,
        improve, and support the Service.
      </p>
      <p className="mt-2">
        The Company will not sell, rent, or disclose Customer Data to third parties except:
        (a) as required by applicable Indian law or a competent court order; (b) to trusted
        sub-processors under appropriate data processing agreements; or (c) with your prior
        written consent.
      </p>
      <p className="mt-2">
        The Company employs industry-standard security measures, including encryption in
        transit (TLS) and at rest, access controls, and regular security reviews, to protect
        Customer Data. No system is completely immune to breaches; we will notify you without
        undue delay of any confirmed data breach affecting your account.
      </p>
      <p className="mt-2">
        Upon termination of your account, Customer Data will be retained for a period of
        14 days during which you may request an export, after which it will be permanently
        deleted, except where retention is required by law.
      </p>

      {/* 6 */}
      <h2 className="text-base font-bold text-gray-900 mt-6 mb-2">6. Acceptable Use Policy</h2>
      <p>You agree not to use the Service to:</p>
      <ul className="list-disc pl-5 space-y-1 mt-2">
        <li>Violate any applicable local, state, national, or international law or regulation.</li>
        <li>Transmit or store content that is unlawful, defamatory, harassing, abusive, or fraudulent.</li>
        <li>Interfere with or disrupt the integrity, performance, or security of the Service or its underlying infrastructure.</li>
        <li>Attempt to gain unauthorised access to any portion of the Service or other users' accounts.</li>
        <li>Reverse-engineer, decompile, or disassemble any part of the Service.</li>
        <li>Use automated tools, bots, or scripts to access, scrape, or test the Service without prior written consent.</li>
      </ul>
      <p className="mt-2">
        The Company reserves the right to investigate and take appropriate legal or technical
        action against any Customer who violates this Policy.
      </p>

      {/* 7 */}
      <h2 className="text-base font-bold text-gray-900 mt-6 mb-2">7. Service Availability & Support</h2>
      <p>
        The Company will endeavour to maintain Service availability of at least 99% uptime,
        measured monthly, excluding scheduled maintenance windows. Scheduled maintenance will
        be notified at least 24 hours in advance wherever possible.
      </p>
      <p className="mt-2">
        Technical support is provided via the in-app Support module and by email at
        <strong> [SUPPORT EMAIL]</strong>. Response times are on a best-effort basis and are
        not guaranteed unless specified in a separate service-level agreement.
      </p>

      {/* 8 */}
      <h2 className="text-base font-bold text-gray-900 mt-6 mb-2">8. Intellectual Property</h2>
      <p>
        The Service, including its software, design, trademarks, and documentation, is the
        exclusive intellectual property of the Company and is protected under applicable Indian
        and international intellectual property laws.
      </p>
      <p className="mt-2">
        Nothing in this Agreement transfers any ownership of the Company's intellectual property
        to the Customer. Feedback, suggestions, or ideas you provide about the Service may be
        used by the Company without restriction or compensation.
      </p>

      {/* 9 */}
      <h2 className="text-base font-bold text-gray-900 mt-6 mb-2">9. Confidentiality</h2>
      <p>
        Each party agrees to keep the other party's Confidential Information strictly
        confidential and not to disclose it to any third party without prior written consent,
        except to employees or contractors who have a need to know and are bound by equivalent
        confidentiality obligations. This obligation survives termination of this Agreement for
        a period of three (3) years.
      </p>

      {/* 10 */}
      <h2 className="text-base font-bold text-gray-900 mt-6 mb-2">10. Termination</h2>
      <p>
        <strong>By Customer:</strong> You may terminate your account at any time by contacting
        us at <strong>[SUPPORT EMAIL]</strong>. No refund will be issued for prepaid subscription
        periods already billed, except where required by applicable law.
      </p>
      <p className="mt-2">
        <strong>By Company:</strong> We may suspend or terminate your account immediately
        (a) for material breach of this Agreement that remains uncured after 7 days' written notice;
        (b) for non-payment of fees after 7 days' notice; (c) if required by law or regulatory
        authority; or (d) if we reasonably believe your use of the Service poses a security or
        legal risk.
      </p>
      <p className="mt-2">
        Upon termination, your right to access the Service ceases immediately and Customer Data
        will be handled as described in Section 5.
      </p>

      {/* 11 */}
      <h2 className="text-base font-bold text-gray-900 mt-6 mb-2">11. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by applicable law, the Company shall not be liable for
        any indirect, incidental, special, consequential, or punitive damages, including loss of
        profits, revenue, data, or goodwill, arising from your use or inability to use the Service.
      </p>
      <p className="mt-2">
        In no event shall the Company's total cumulative liability for all claims arising under
        or related to this Agreement exceed the total fees paid by you to the Company in the
        three (3) months immediately preceding the event giving rise to the claim.
      </p>

      {/* 12 */}
      <h2 className="text-base font-bold text-gray-900 mt-6 mb-2">12. Disclaimer of Warranties</h2>
      <p>
        The Service is provided "as is" and "as available" without any warranties of any kind,
        express or implied, including but not limited to warranties of merchantability, fitness
        for a particular purpose, non-infringement, or uninterrupted or error-free operation.
        The Company does not warrant that the Service will meet your specific requirements or
        that defects will be corrected.
      </p>

      {/* 13 */}
      <h2 className="text-base font-bold text-gray-900 mt-6 mb-2">13. Indemnification</h2>
      <p>
        You agree to indemnify, defend, and hold harmless the Company and its officers,
        directors, employees, and agents from and against any claims, damages, losses,
        liabilities, costs, and expenses (including reasonable legal fees) arising out of or
        related to: (a) your use of the Service; (b) your violation of this Agreement; (c) your
        violation of any applicable law; or (d) any third-party claim arising from Customer Data
        you provide.
      </p>

      {/* 14 */}
      <h2 className="text-base font-bold text-gray-900 mt-6 mb-2">14. Governing Law & Dispute Resolution</h2>
      <p>
        This Agreement shall be governed by and construed in accordance with the laws of India.
        Any dispute, controversy, or claim arising out of or relating to this Agreement, or the
        breach, termination, or validity thereof, shall be subject to the exclusive jurisdiction
        of the courts located at <strong>[CITY], [STATE], India</strong>.
      </p>
      <p className="mt-2">
        Before initiating any legal proceedings, the parties agree to attempt to resolve any
        dispute through good-faith negotiation for a period of 30 days.
      </p>

      {/* 15 */}
      <h2 className="text-base font-bold text-gray-900 mt-6 mb-2">15. Modifications to this Agreement</h2>
      <p>
        The Company reserves the right to modify these terms at any time. We will notify you of
        material changes via email or an in-app notification at least 15 days before the changes
        take effect. Your continued use of the Service after the effective date constitutes
        acceptance of the revised terms.
      </p>

      {/* 16 */}
      <h2 className="text-base font-bold text-gray-900 mt-6 mb-2">16. Miscellaneous</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Entire Agreement:</strong> This Agreement constitutes the entire agreement between the parties regarding the Service and supersedes all prior agreements or representations.</li>
        <li><strong>Severability:</strong> If any provision of this Agreement is found to be unenforceable, the remaining provisions shall continue in full force.</li>
        <li><strong>No Waiver:</strong> Failure to enforce any right under this Agreement does not constitute a waiver of that right.</li>
        <li><strong>Assignment:</strong> You may not assign this Agreement without our prior written consent. We may assign it freely in connection with a merger, acquisition, or sale of assets.</li>
        <li><strong>Force Majeure:</strong> Neither party shall be liable for delays or failures in performance resulting from causes beyond their reasonable control.</li>
      </ul>

      {/* 17 */}
      <h2 className="text-base font-bold text-gray-900 mt-6 mb-2">17. Contact Information</h2>
      <p>
        For questions about these terms, billing, or data requests, please contact:
      </p>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-2 text-sm space-y-1">
        <p><strong>[COMPANY NAME]</strong></p>
        <p>[ADDRESS LINE 1]</p>
        <p>[CITY], [STATE] – [PINCODE], India</p>
        <p>Email: <strong>[SUPPORT EMAIL]</strong></p>
      </div>

    </div>
  )
}

export default function Terms() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <FileText size={24} className="text-gray-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Terms of Service</h1>
          <p className="text-sm text-gray-500">CheesePOS Subscription Agreement · Version {TERMS_VERSION} · {TERMS_DATE}</p>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <TermsContent />
      </div>
    </div>
  )
}

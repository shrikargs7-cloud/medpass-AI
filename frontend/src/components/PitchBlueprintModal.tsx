import React, { useState } from 'react';
import {
  X, CheckCircle2, Shield, Layers, TrendingUp,
  Award, FileText, ArrowRight, Activity, Clock, Users, Building, Lock
} from 'lucide-react';

interface PitchBlueprintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PitchBlueprintModal: React.FC<PitchBlueprintModalProps> = ({ isOpen, onClose }) => {
  const [activeSlide, setActiveSlide] = useState<1 | 2 | 3 | 4>(1);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative my-8 text-slate-900 animate-fade-in max-h-[92vh] flex flex-col">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="px-3 py-1 bg-teal-600 text-white font-bold text-xs rounded-lg shadow-sm">
              THE X
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base text-slate-900">MedPass AI — Bridging the Healthcare Authorization Gap</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-teal-100 text-teal-800">DSU DEVHACK 3.0</span>
              </div>
              <p className="text-xs text-slate-500">RV University, Bengaluru, Karnataka • Healthcare Track Baseline Deck</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Slide Switcher Tabs */}
        <div className="flex items-center space-x-2 py-3 border-b border-slate-100 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveSlide(1)}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
              activeSlide === 1 ? 'bg-teal-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            1. Problem & The 4 Pillars
          </button>
          <button
            onClick={() => setActiveSlide(2)}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
              activeSlide === 2 ? 'bg-teal-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            2. 8-Step Architecture
          </button>
          <button
            onClick={() => setActiveSlide(3)}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
              activeSlide === 3 ? 'bg-teal-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            3. Feasibility & Impact
          </button>
          <button
            onClick={() => setActiveSlide(4)}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
              activeSlide === 4 ? 'bg-teal-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            4. Business Model Canvas
          </button>
        </div>

        {/* Slide Contents */}
        <div className="flex-1 overflow-y-auto py-5 space-y-6">
          {/* SLIDE 1: Problem & Solution */}
          {activeSlide === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* The Problem */}
                <div className="bg-rose-50/50 p-5 rounded-2xl border border-rose-100 space-y-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider bg-rose-600 text-white px-2 py-0.5 rounded">
                      The Problem
                    </span>
                    <h3 className="font-bold text-slate-900 text-lg">Insured. Yet Uncertain.</h3>
                  </div>
                  <p className="text-xs text-slate-600">
                    A patient with valid health insurance is admitted to a hospital. By discharge, they face unexpected bills, hours of waiting, and zero clarity on what their policy actually covered.
                  </p>

                  <div className="space-y-2.5 text-xs">
                    <div className="p-3 bg-white rounded-xl border border-rose-200/60 shadow-2xs">
                      <strong className="text-rose-700">PATIENT PAIN:</strong> 6 in 10 insured patients wait 6 to 48 hours on discharge day with valid coverage.
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-rose-200/60 shadow-2xs">
                      <strong className="text-amber-700">HOSPITAL PAIN:</strong> Insurance desks spend 4 to 6 hours per case chasing documents, emails, and re-submissions.
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-rose-200/60 shadow-2xs">
                      <strong className="text-indigo-700">INSURER / TPA PAIN:</strong> Incomplete submissions trigger repeated queries, breaching IRDAI's 1-hour pre-authorization mandate.
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900 text-white rounded-xl text-xs font-mono">
                    <strong className="text-teal-400">ROOT CAUSE:</strong> No intelligence layer connecting clinical care, insurance policy, and patient financial liability.
                  </div>
                </div>

                {/* The Solution */}
                <div className="bg-teal-50/50 p-5 rounded-2xl border border-teal-100 space-y-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider bg-teal-700 text-white px-2 py-0.5 rounded">
                      Our Solution
                    </span>
                    <h3 className="font-bold text-slate-900 text-lg">Meet MedPass AI</h3>
                  </div>
                  <p className="text-xs text-teal-900 font-medium">
                    The Intelligence Layer for Healthcare Authorization connecting fragmented clinical info with insurance requirements.
                  </p>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-white rounded-xl border border-teal-200/70 shadow-2xs">
                      <div className="font-bold text-teal-800">1. Authorization Readiness</div>
                      <p className="text-[11px] text-slate-500 mt-1">Know if the case is ready before submission via a 0–100% weighted score.</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-teal-200/70 shadow-2xs">
                      <div className="font-bold text-teal-800">2. Coverage Clarity</div>
                      <p className="text-[11px] text-slate-500 mt-1">Know what insurance covers vs what patient owes at admission.</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-teal-200/70 shadow-2xs">
                      <div className="font-bold text-teal-800">3. Discharge Intelligence</div>
                      <p className="text-[11px] text-slate-500 mt-1">Pinpoint exact blockers preventing the patient from going home.</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-teal-200/70 shadow-2xs">
                      <div className="font-bold text-teal-800">4. Outcome Learning</div>
                      <p className="text-[11px] text-slate-500 mt-1">Governed Trace Commons layer turns every case into longitudinal learning.</p>
                    </div>
                  </div>

                  <div className="p-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl text-xs font-bold text-center">
                    "From fragmented records to a submission ready case in minutes, not hours."
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 2: 8-Step Architecture */}
          {activeSlide === 2 && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                  Implementation Methodology: End-to-End Flow from Hospital to Payer
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  {[
                    { step: '1', title: 'Data Ingestion', desc: 'Patient EMR, lab reports, & insurance docs uploaded' },
                    { step: '2', title: 'OCR & Extraction', desc: 'Text extracted from scanned docs using AI/OCR models' },
                    { step: '3', title: 'NLP Structuring', desc: 'Clinical data mapped to ICD-10 & CPT classifications' },
                    { step: '4', title: 'Policy Analysis', desc: 'Maps treatment against policy terms, sub-limits, & room cap' },
                    { step: '5', title: 'Gap Detection', desc: 'Missing documents, code mismatches, & unapproved items flagged' },
                    { step: '6', title: 'Readiness Scoring', desc: 'Authorization Readiness Score (0 to 100%) computed per case' },
                    { step: '7', title: 'Human Review', desc: 'Insurance desk reviews all flagged items and approves' },
                    { step: '8', title: 'Payer Submission', desc: 'Structured complete case submitted via NHCX / Beeceptor API' }
                  ].map((s) => (
                    <div key={s.step} className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                      <div className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-[10px] mb-1.5">
                        {s.step}
                      </div>
                      <span className="font-bold text-slate-900 block">{s.title}</span>
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Three-tier architecture */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <span className="font-bold text-indigo-700 uppercase tracking-wider text-[11px]">1. Hospital Layer</span>
                  <ul className="mt-2 space-y-1 text-slate-600 text-[11px]">
                    <li>• HIS / EMR System integration</li>
                    <li>• Lab Reports & Diagnostic Scans</li>
                    <li>• Hospital Itemized Billing System</li>
                    <li>• Insurance E-Cards & Pre-auth forms</li>
                  </ul>
                </div>
                <div className="p-4 bg-teal-50/60 rounded-xl border border-teal-200 shadow-2xs">
                  <span className="font-bold text-teal-800 uppercase tracking-wider text-[11px]">2. MedPass AI Engine</span>
                  <ul className="mt-2 space-y-1 text-teal-900 text-[11px]">
                    <li>• NLP Extraction & Structuring</li>
                    <li>• Deterministic Policy Knowledge Base</li>
                    <li>• Blocker & Gap Detection Engine</li>
                    <li>• Readiness Score (0-100%) Module</li>
                  </ul>
                </div>
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <span className="font-bold text-emerald-700 uppercase tracking-wider text-[11px]">3. Payer Layer</span>
                  <ul className="mt-2 space-y-1 text-slate-600 text-[11px]">
                    <li>• Health Insurer Portal Adjudication</li>
                    <li>• TPA Clearinghouse Workflows</li>
                    <li>• NHCX Interoperability Hub</li>
                    <li>• IRDAI 1-Hour Mandate Compliance</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 3: Feasibility & Impact */}
          {activeSlide === 3 && (
            <div className="space-y-6">
              {/* Impact Callouts */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl text-center">
                  <div className="text-3xl font-extrabold text-emerald-700">6 to 48h → &lt;3h</div>
                  <div className="text-xs font-semibold text-emerald-900 mt-1">Discharge Wait IRDAI Target Met</div>
                  <p className="text-[11px] text-emerald-700 mt-1">Near zero hospital exit friction on discharge day</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 p-5 rounded-2xl text-center">
                  <div className="text-3xl font-extrabold text-blue-700">50% Reduction</div>
                  <div className="text-xs font-semibold text-blue-900 mt-1">In Insurer Queries Per Case</div>
                  <p className="text-[11px] text-blue-700 mt-1">Pre-submission gap detection eliminates back-and-forth</p>
                </div>

                <div className="bg-purple-50 border border-purple-200 p-5 rounded-2xl text-center">
                  <div className="text-3xl font-extrabold text-purple-700">500M+</div>
                  <div className="text-xs font-semibold text-purple-900 mt-1">Insured Lives in India</div>
                  <p className="text-[11px] text-purple-700 mt-1">Addressable market under PM-JAY & private health cover</p>
                </div>
              </div>

              {/* Multi-stakeholder Benefits */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 bg-white rounded-xl border border-slate-200">
                  <strong className="text-teal-700 block mb-1">Social Impact</strong>
                  <p className="text-slate-600 text-[11px]">
                    Patients discharged faster with less financial shock and greater coverage transparency throughout their hospital stay.
                  </p>
                </div>
                <div className="p-4 bg-white rounded-xl border border-slate-200">
                  <strong className="text-indigo-700 block mb-1">Economic Impact</strong>
                  <p className="text-slate-600 text-[11px]">
                    Hospitals recover revenue faster. Insurers receive cleaner submissions. Administrative costs reduced across all stakeholders.
                  </p>
                </div>
                <div className="p-4 bg-white rounded-xl border border-slate-200">
                  <strong className="text-amber-700 block mb-1">Operational Impact</strong>
                  <p className="text-slate-600 text-[11px]">
                    Paperless workflows, digitized documentation, and NHCX-aligned data exchange replacing manual email and fax processes.
                  </p>
                </div>
              </div>

              {/* Challenges & Governance */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block mb-2">
                  Regulatory & Privacy Compliance Strategy
                </span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <strong className="text-rose-600">DPDP Act 2023</strong>: Explicit consent and de-identification gates
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <strong className="text-blue-600">IRDAI Preauth</strong>: 1-hour pre-authorization and 3-hour discharge SLA
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <strong className="text-emerald-600">NHCX Ready</strong>: ABDM & NHCX JSON/FHIR interchange compatibility
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <strong className="text-purple-600">HIPAA Safeguards</strong>: AES-256 storage and strict tenant isolation
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 4: Business Model Canvas */}
          {activeSlide === 4 && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <strong className="text-slate-800 block uppercase tracking-wider text-[11px]">Key Partners</strong>
                  <ul className="text-[11px] text-slate-600 space-y-1">
                    <li>• Hospital Chains (Apollo, Fortis)</li>
                    <li>• TPAs (MediAssist, MDIndia)</li>
                    <li>• Insurers (Star Health, HDFC Ergo)</li>
                    <li>• NHCX / National Health Authority</li>
                    <li>• EMR Vendors (Practo, Insta HMS)</li>
                  </ul>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <strong className="text-slate-800 block uppercase tracking-wider text-[11px]">Key Activities</strong>
                  <ul className="text-[11px] text-slate-600 space-y-1">
                    <li>• Policy Rules Engine Maintenance</li>
                    <li>• AI/LLM Extraction Structuring</li>
                    <li>• Hospital EMR Integration</li>
                    <li>• Regulatory Compliance (IRDAI & DPDP)</li>
                  </ul>
                </div>

                <div className="p-3.5 bg-teal-50/80 rounded-xl border border-teal-200 space-y-2">
                  <strong className="text-teal-900 block uppercase tracking-wider text-[11px]">Value Proposition</strong>
                  <div className="text-center my-2 p-2 bg-white rounded-lg border border-teal-200">
                    <div className="text-xl font-extrabold text-teal-700">92 / 100</div>
                    <span className="text-[10px] uppercase font-bold text-emerald-700">READY TO SUBMIT</span>
                  </div>
                  <ul className="text-[10px] text-teal-900 space-y-1">
                    <li>• Readiness score before every submission</li>
                    <li>• Coverage clarity at admission</li>
                    <li>• Discharge blocker intelligence</li>
                    <li>• 50% fewer insurer queries</li>
                  </ul>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <strong className="text-slate-800 block uppercase tracking-wider text-[11px]">Customer Segments</strong>
                  <ul className="text-[11px] text-slate-600 space-y-1">
                    <li><strong>Primary</strong>: Private hospital chains, RCM teams (500+ beds)</li>
                    <li><strong>Secondary</strong>: TPAs managing high-volume claims</li>
                    <li><strong>Tertiary</strong>: Health insurers seeking cleaner dossiers</li>
                  </ul>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <strong className="text-slate-800 block uppercase tracking-wider text-[11px]">Revenue Streams</strong>
                  <ul className="text-[11px] text-slate-600 space-y-1">
                    <li>• SaaS Subscription per hospital (tiered by bed count)</li>
                    <li>• Per-case processing fee for high volume</li>
                    <li>• TPA licensing model</li>
                    <li>• Premium Trace Commons outcome intelligence</li>
                  </ul>
                </div>
              </div>

              <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between text-xs font-mono">
                <span>Making Healthcare Authorization Intelligent.</span>
                <span className="text-teal-400">India • 500M+ Insured Lives • IRDAI Compliant</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

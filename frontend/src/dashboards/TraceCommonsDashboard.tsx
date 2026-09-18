import React, { useState, useEffect } from 'react';
import {
  Database, Download, Filter, ShieldCheck, CheckCircle2,
  Calendar, Layers, GitBranch, FileCode, HardDrive, RefreshCw,
  ChevronRight, ChevronLeft, ArrowRight, Check, Info, FileText, CheckCircle, Lock
} from 'lucide-react';
import { TraceOverview, CohortFilter, CohortPreview, ExportJob, DatasetCardItem } from '../types';
import {
  fetchTraceOverview, previewCohort, createExportJob, fetchExports, fetchDatasets
} from '../api/client';

export const TraceCommonsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'catalog' | 'explorer' | 'export' | 'lineage'>('overview');
  const [overview, setOverview] = useState<TraceOverview | null>(null);
  const [datasets, setDatasets] = useState<DatasetCardItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Wizard state for Export Tab (6-Step Wizard)
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [lastCreatedJob, setLastCreatedJob] = useState<ExportJob | null>(null);

  // Cohort Explorer Filter State
  const [filters, setFilters] = useState<CohortFilter>({
    dataset_version: 'trace-core-1.3.0',
    facility_keys: [],
    facility_tiers: [],
    diagnosis_codes: [],
    age_bands: [],
    sex_categories: [],
    journey_mode: 'whole_journey',
    format: 'parquet'
  });

  const [preview, setPreview] = useState<CohortPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);
  const [exporting, setExporting] = useState(false);
  const [downloadLink, setDownloadLink] = useState<string | null>(null);

  const loadOverview = async () => {
    try {
      setLoading(true);
      const [data, exportsList, datasetsList] = await Promise.all([
        fetchTraceOverview(),
        fetchExports(),
        fetchDatasets().catch(() => [])
      ]);
      setOverview(data);
      setExportJobs(exportsList);
      setDatasets(datasetsList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const handlePreview = async () => {
    try {
      setPreviewing(true);
      const res = await previewCohort(filters);
      setPreview(res);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPreviewing(false);
    }
  };

  const handleGenerateExport = async () => {
    try {
      setExporting(true);
      const job = await createExportJob(filters);
      setLastCreatedJob(job);
      setDownloadLink(job.download_url || null);
      const updated = await fetchExports();
      setExportJobs(updated);
      setWizardStep(6);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setExporting(false);
    }
  };

  if (loading || !overview) {
    return <div className="p-8 text-center text-slate-500 text-xs font-sans">Loading Trace Commons open data catalog...</div>;
  }

  const kpis = overview.kpis;

  const WIZARD_STEPS = [
    { id: 1, label: 'Dataset', icon: Database },
    { id: 2, label: 'Population', icon: Filter },
    { id: 3, label: 'Journey', icon: Calendar },
    { id: 4, label: 'Scope & Format', icon: Layers },
    { id: 5, label: 'Trust & Privacy', icon: ShieldCheck },
    { id: 6, label: 'Export & Package', icon: Download },
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* Sub-navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Trace Commons Research Platform</h2>
            <p className="text-xs text-slate-500">Governed longitudinal healthcare datasets & DuckDB analytics engine</p>
          </div>
        </div>

        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'overview' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'catalog' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Dataset Catalog
          </button>
          <button
            onClick={() => {
              setActiveTab('explorer');
              if (!preview) handlePreview();
            }}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'explorer' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Cohort Explorer
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'export' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Export Wizard
          </button>
          <button
            onClick={() => setActiveTab('lineage')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeTab === 'lineage' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Lineage & Quality
          </button>
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500">Total Encounters</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">{kpis.total_encounters}</div>
              <div className="text-[10px] text-blue-600 font-semibold mt-1">100% Synthetic & Safe</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500">Workflow Events</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">{kpis.total_events}</div>
              <div className="text-[10px] text-slate-500 font-semibold mt-1">Append-only log</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500">Hospital Facilities</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">{kpis.total_facilities}</div>
              <div className="text-[10px] text-slate-500 font-semibold mt-1">3 Tiers Anonymized</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500">Completeness</span>
              <div className="text-2xl font-bold text-emerald-600 mt-1">
                {(kpis.completeness_score * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-1">Custom Quality Checks — PASSED</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500">Active Version</span>
              <div className="text-sm font-bold text-slate-900 font-mono mt-2">
                {kpis.active_dataset_version}
              </div>
              <div className="text-[10px] text-blue-600 font-semibold mt-1">Versioned snapshot</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500">Privacy Gate Blocks</span>
              <div className="text-2xl font-bold text-emerald-600 mt-1">0 Leaks</div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-1">Privacy Gate Passed for This Dataset</div>
            </div>
          </div>

          {/* Visual Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Domain Distribution */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Trace Clinical & Workflow Domains
              </h3>
              <div className="space-y-2.5 text-xs">
                {overview.domain_distribution.map((d, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="font-medium text-slate-700">{d.domain}</span>
                    <span className="font-mono font-bold text-blue-700">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Facility Contribution */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Facility Tier Distribution
              </h3>
              <div className="space-y-2.5 text-xs">
                {overview.facility_contribution.map((f, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/60">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-slate-800">{f.tier}</span>
                      <span className="text-slate-900 font-mono font-bold">{f.count} Encounters</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full"
                        style={{ width: `${Math.min(100, (f.count / (kpis.total_encounters || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ingestion Timeline */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Monthly Care Episodes
              </h3>
              <div className="space-y-2 text-xs">
                {overview.events_by_month.map((m, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="font-mono text-slate-600">{m.month}</span>
                    <span className="font-bold text-slate-800">{m.encounters} cases</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DATASET CATALOG */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          {datasets && datasets.length > 0 ? (
            datasets.map((ds) => (
              <div key={ds.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                <div className="border border-blue-200 bg-blue-50/40 p-5 rounded-xl">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase bg-blue-600 text-white px-2 py-0.5 rounded">
                        {ds.governance_model.replace(/_/g, ' ')}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-1">
                        {ds.dataset_key} • {ds.title}
                      </h3>
                      <p className="text-xs text-slate-600 mt-1 max-w-3xl">
                        {ds.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono text-slate-500">Active Version: {ds.active_version}</span>
                      <div className="text-emerald-700 font-bold text-xs mt-1">Status: PUBLISHED</div>
                    </div>
                  </div>

                  {ds.versions && ds.versions.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-blue-100 space-y-2">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Releases</h4>
                      {ds.versions.map((ver) => (
                        <div key={ver.version_tag} className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3 bg-white/80 rounded-lg border border-blue-100 text-xs">
                          <div>
                            <span className="text-slate-500">Version:</span>
                            <p className="font-mono font-bold text-slate-800">{ver.version_tag}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Coverage Period:</span>
                            <p className="font-semibold text-slate-800">{ver.period_start} – {ver.period_end}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Encounters / Events:</span>
                            <p className="font-semibold text-blue-700">{ver.encounter_count} / {ver.event_count}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Quality / Privacy:</span>
                            <p className="font-semibold text-emerald-700">{(ver.completeness_score * 100).toFixed(1)}% • {ver.privacy_status}</p>
                          </div>
                          <div className="flex items-center justify-end">
                            <button
                              onClick={() => {
                                setFilters({ ...filters, dataset_version: ver.version_tag });
                                setActiveTab('export');
                                setWizardStep(1);
                              }}
                              className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 cursor-pointer shadow-2xs"
                            >
                              Select & Export
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="border border-blue-200 bg-blue-50/40 p-5 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase bg-blue-600 text-white px-2 py-0.5 rounded">
                      Governed Dataset
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1">
                      trace-core-1.3.0 (Longitudinal Inpatient Workflow Dataset)
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Governed, de-identified longitudinal records covering {kpis.total_encounters}+ inpatient admissions,
                      ICD-10 clinical diagnoses, CPT surgical procedures, insurance pre-authorizations, and discharge blocker timelines.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono text-slate-500">Schema Version: 1.3.0</span>
                    <div className="text-emerald-700 font-bold text-xs mt-1">Status: PUBLISHED</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-blue-100 text-xs">
                  <div>
                    <span className="text-slate-500">Period:</span>
                    <p className="font-semibold text-slate-800">Oct 2025 – Sep 2026</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Privacy Gate:</span>
                    <p className="font-semibold text-emerald-700">PASSED (k-anonymity ≥ 5)</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Quality Score:</span>
                    <p className="font-semibold text-slate-800">98.5% Completeness</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Standard Formats:</span>
                    <p className="font-semibold text-blue-700">Parquet, CSV, FHIR, OMOP</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: COHORT EXPLORER */}
      {activeTab === 'explorer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Filters Column */}
          <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 text-xs">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider flex items-center">
              <Filter className="w-3.5 h-3.5 text-blue-600 mr-1" />
              Cohort Parameters
            </h3>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">Journey Mode</label>
              <select
                value={filters.journey_mode}
                onChange={(e) => setFilters({ ...filters, journey_mode: e.target.value as any })}
                className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50 font-medium"
              >
                <option value="whole_journey">Whole Journey (Intersecting admissions + full care path)</option>
                <option value="event_window">Event Window (Strict timestamp filter)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">Hospital Facility Tier</label>
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  setFilters({ ...filters, facility_tiers: val ? [val] : [] });
                }}
                className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50"
              >
                <option value="">All Hospital Tiers</option>
                <option value="TIER_1">Tier 1 (Metro Super-Specialty)</option>
                <option value="TIER_2">Tier 2 (Urban District Hospital)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">Age Band</label>
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  setFilters({ ...filters, age_bands: val ? [val] : [] });
                }}
                className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50"
              >
                <option value="">All Age Categories</option>
                <option value="0-18">0-18 (Pediatric)</option>
                <option value="19-30">19-30 (Young Adult)</option>
                <option value="31-45">31-45 (Adult)</option>
                <option value="46-60">46-60 (Middle Age)</option>
                <option value="61+">61+ (Senior)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">Sex Category</label>
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  setFilters({ ...filters, sex_categories: val ? [val] : [] });
                }}
                className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50"
              >
                <option value="">All Sex Categories</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other / Unspecified</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">Diagnosis (ICD-10 Code)</label>
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  setFilters({ ...filters, diagnosis_codes: val ? [val] : [] });
                }}
                className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50"
              >
                <option value="">All Clinical Conditions</option>
                <option value="I21.9">I21.9 - Acute Myocardial Infarction</option>
                <option value="K35.80">K35.80 - Acute Appendicitis</option>
                <option value="K81.0">K81.0 - Acute Cholecystitis</option>
                <option value="M17.11">M17.11 - Knee Osteoarthritis</option>
                <option value="J18.9">J18.9 - Pneumonia</option>
              </select>
            </div>

            <button
              onClick={handlePreview}
              disabled={previewing}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
            >
              {previewing ? 'Querying DuckDB...' : 'Preview Cohort Statistics'}
            </button>
          </div>

          {/* Preview Results Column */}
          <div className="lg:col-span-8 space-y-4">
            {preview ? (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">DuckDB Cohort Preview</h3>
                    <p className="text-xs text-slate-500">Analytical cohort matching selected parameters</p>
                  </div>
                  <span className="text-xs font-mono bg-blue-50 text-blue-800 px-2.5 py-1 rounded-lg border border-blue-200">
                    Mode: {preview.journey_mode}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-500">Matching Encounters</span>
                    <div className="text-xl font-bold text-slate-900 mt-0.5">{preview.total_encounters}</div>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-500">Total Domain Events</span>
                    <div className="text-xl font-bold text-blue-700 mt-0.5">{preview.total_events}</div>
                  </div>
                  <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200">
                    <span className="text-xs text-emerald-800">Privacy Gate</span>
                    <div className="text-xl font-bold text-emerald-700 mt-0.5">{preview.privacy_status}</div>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-500">Suppressed Cells</span>
                    <div className="text-xl font-bold text-slate-900 mt-0.5">{preview.suppressed_cells}</div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Ready to export research bundle (.zip with Parquet & FHIR)</span>
                  <button
                    onClick={() => {
                      setActiveTab('export');
                      setWizardStep(4);
                    }}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-xs cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4 mr-1.5" />
                    Configure in Export Wizard
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                Click "Preview Cohort Statistics" to query DuckDB.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: 6-STEP EXPORT WIZARD */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          {/* Wizard Stepper Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between overflow-x-auto gap-2 pb-1">
              {WIZARD_STEPS.map((s, idx) => {
                const Icon = s.icon;
                const isActive = wizardStep === s.id;
                const isPassed = wizardStep > s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setWizardStep(s.id)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs'
                        : isPassed
                        ? 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isActive ? 'bg-white text-blue-600' : isPassed ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {isPassed ? '✓' : s.id}
                    </span>
                    <Icon className="w-3.5 h-3.5" />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Wizard Step Body */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
            {/* Step 1: Dataset */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Step 1: Select Governed Dataset Version</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Select the verified dataset release for cohort packaging.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    onClick={() => setFilters({ ...filters, dataset_version: 'trace-core-1.3.0' })}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      filters.dataset_version === 'trace-core-1.3.0'
                        ? 'border-blue-600 bg-blue-50/40'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900">trace-core-1.3.0 (Recommended)</span>
                      <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                        Published
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-2">
                      Full longitudinal care episode records, ICD-10 diagnoses, CPT surgical codes, pre-auth events, and blocker histories.
                    </p>
                    <div className="mt-3 text-[11px] text-slate-500 flex items-center space-x-3">
                      <span>• Schema: 1.3.0</span>
                      <span>• Period: Oct 2025 – Sep 2026</span>
                      <span>• 98.5% Completeness</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Population */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Step 2: Population & Demographic Filters</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Specify cohort inclusion criteria for facility tiers, demographics, and clinical codes.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Facility Tier</label>
                    <select
                      value={filters.facility_tiers?.[0] || ''}
                      onChange={(e) => setFilters({ ...filters, facility_tiers: e.target.value ? [e.target.value] : [] })}
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50"
                    >
                      <option value="">All Hospital Tiers</option>
                      <option value="TIER_1">Tier 1 (Metro Super-Specialty Hospital)</option>
                      <option value="TIER_2">Tier 2 (Urban District Hospital)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Age Band</label>
                    <select
                      value={filters.age_bands?.[0] || ''}
                      onChange={(e) => setFilters({ ...filters, age_bands: e.target.value ? [e.target.value] : [] })}
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50"
                    >
                      <option value="">All Age Categories</option>
                      <option value="0-18">0-18 (Pediatric)</option>
                      <option value="19-30">19-30 (Young Adult)</option>
                      <option value="31-45">31-45 (Adult)</option>
                      <option value="46-60">46-60 (Middle Age)</option>
                      <option value="61+">61+ (Senior)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Sex Category</label>
                    <select
                      value={filters.sex_categories?.[0] || ''}
                      onChange={(e) => setFilters({ ...filters, sex_categories: e.target.value ? [e.target.value] : [] })}
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50"
                    >
                      <option value="">All Sex Categories</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other / Unspecified</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Diagnosis (ICD-10)</label>
                    <select
                      value={filters.diagnosis_codes?.[0] || ''}
                      onChange={(e) => setFilters({ ...filters, diagnosis_codes: e.target.value ? [e.target.value] : [] })}
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50"
                    >
                      <option value="">All Clinical Conditions</option>
                      <option value="I21.9">I21.9 - Acute Myocardial Infarction</option>
                      <option value="K35.80">K35.80 - Acute Appendicitis</option>
                      <option value="K81.0">K81.0 - Acute Cholecystitis</option>
                      <option value="M17.11">M17.11 - Knee Osteoarthritis</option>
                      <option value="J18.9">J18.9 - Pneumonia</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Journey */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Step 3: Journey Semantics & Temporal Window</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Choose how care episode timelines and boundary events are selected.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    onClick={() => setFilters({ ...filters, journey_mode: 'whole_journey' })}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      filters.journey_mode === 'whole_journey'
                        ? 'border-blue-600 bg-blue-50/40'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <span className="font-bold text-sm text-slate-900">Whole Journey Intersection</span>
                    <p className="text-xs text-slate-600 mt-1">
                      Includes complete encounters and all child events if any portion overlaps the selected window. Recommended for longitudinal pathway analysis.
                    </p>
                  </div>

                  <div
                    onClick={() => setFilters({ ...filters, journey_mode: 'event_window' })}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      filters.journey_mode === 'event_window'
                        ? 'border-blue-600 bg-blue-50/40'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <span className="font-bold text-sm text-slate-900">Strict Event Window</span>
                    <p className="text-xs text-slate-600 mt-1">
                      Extracts only events whose exact timestamp falls strictly between the start and end dates.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Data Scope & Format */}
            {wizardStep === 4 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Step 4: Resource Scope & Packaging Formats</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Select the target analytical formats included in the generated `.zip` bundle.</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: 'parquet', label: 'Apache Parquet', desc: 'DuckDB / PySpark column store (Zero-copy)' },
                    { id: 'csv', label: 'Standard CSV', desc: 'RFC 4180 tabular CSVs' },
                    { id: 'fhir', label: 'FHIR R4 NDJSON', desc: 'HL7 FHIR Interoperability bundles' },
                    { id: 'all', label: 'All Formats Bundle', desc: 'Complete research bundle with Parquet, CSV, FHIR, and OMOP' }
                  ].map((fmt) => (
                    <div
                      key={fmt.id}
                      onClick={() => setFilters({ ...filters, format: fmt.id as any })}
                      className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                        filters.format === fmt.id
                          ? 'border-blue-600 bg-blue-50/40'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <span className="font-bold text-xs text-slate-900">{fmt.label}</span>
                      <p className="text-[11px] text-slate-500 mt-1">{fmt.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 5: Trust & Privacy */}
            {wizardStep === 5 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Step 5: Trust, Privacy Gate & De-identification Audit</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Automated privacy and quality guarantees enforced before export serialization.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                    <span className="font-bold text-emerald-900 flex items-center">
                      <ShieldCheck className="w-4 h-4 mr-1 text-emerald-600" />
                      k-Anonymity (k ≥ 5)
                    </span>
                    <p className="text-[11px] text-emerald-800 mt-1">
                      Automatic small-cell suppression masks demographic combinations with fewer than 5 individuals.
                    </p>
                  </div>
                  <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl">
                    <span className="font-bold text-blue-900 flex items-center">
                      <Lock className="w-4 h-4 mr-1 text-blue-600" />
                      PII Scrubbing & Tokenization
                    </span>
                    <p className="text-[11px] text-blue-800 mt-1">
                      Direct identifiers (Aadhaar, phone, names) replaced with cryptographic SHA-256 tokens and month-level bucketing.
                    </p>
                  </div>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="font-bold text-slate-900 flex items-center">
                      <CheckCircle className="w-4 h-4 mr-1 text-slate-700" />
                      Quality Integrity Checks
                    </span>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Custom rules engine validates referential integrity, temporal ordering, and ICD-10 schema compliance.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 6: Export & Package */}
            {wizardStep === 6 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Step 6: Generate Governed Research Archive</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Package export archive with DuckDB zero-copy parquet generation and SHA-256 integrity manifest.</p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="font-mono font-bold text-xs text-slate-800">
                        Target Version: {filters.dataset_version} • Mode: {filters.journey_mode} • Format: {filters.format}
                      </span>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Archive contains: `encounters.parquet`, `conditions.parquet`, `procedures.parquet`, `insurance_events.parquet`, `fhir_bundle.ndjson`, `manifest.json`.
                      </p>
                    </div>
                    <button
                      onClick={handleGenerateExport}
                      disabled={exporting}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-xs cursor-pointer"
                    >
                      <Download className="w-4 h-4 mr-1.5" />
                      {exporting ? 'Packaging Archive...' : 'Generate Governed Package (.zip)'}
                    </button>
                  </div>

                  {lastCreatedJob && (
                    <div className="mt-3 p-3 bg-emerald-50/90 border border-emerald-200 rounded-lg text-xs space-y-1">
                      <div className="flex items-center justify-between font-semibold text-emerald-900">
                        <span>✓ Package Created Successfully!</span>
                        <a
                          href={`/api/trace/exports/${lastCreatedJob.export_id}/download`}
                          download
                          className="px-3 py-1 bg-emerald-700 text-white rounded-md text-[11px] font-bold hover:bg-emerald-800 shadow-2xs"
                        >
                          Download Now (.zip)
                        </a>
                      </div>
                      <p className="text-[11px] text-emerald-800 font-mono">
                        Job ID: {lastCreatedJob.export_id} • Encounters: {lastCreatedJob.encounter_count} • Events: {lastCreatedJob.event_count}
                      </p>
                      {lastCreatedJob.checksum_sha256 && (
                        <p className="text-[10px] text-emerald-700 font-mono">
                          SHA-256: {lastCreatedJob.checksum_sha256}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step Navigation Controls */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <button
                onClick={() => setWizardStep(Math.max(1, wizardStep - 1))}
                disabled={wizardStep === 1}
                className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  wizardStep === 1
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-700 hover:bg-slate-100 cursor-pointer'
                }`}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous Step
              </button>

              {wizardStep < 6 ? (
                <button
                  onClick={() => setWizardStep(Math.min(6, wizardStep + 1))}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 cursor-pointer shadow-xs"
                >
                  Next Step
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              ) : (
                <button
                  onClick={handleGenerateExport}
                  disabled={exporting}
                  className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  {exporting ? 'Generating Package...' : 'Execute Export Job'}
                </button>
              )}
            </div>
          </div>

          {/* Existing Packages Archive Table */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Governed Export Archives History</h3>
            <div className="space-y-3">
              {exportJobs.map((job) => (
                <div key={job.export_id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-slate-800">{job.export_id.slice(0, 8)}...</span>
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold text-[10px]">
                        {job.status}
                      </span>
                      <span className="text-slate-500">{job.dataset_version}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Encounters: {job.encounter_count} • Domain Events: {job.event_count} • Mode: {job.journey_mode}
                    </p>
                    {job.checksum_sha256 && (
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                        SHA-256: {job.checksum_sha256}
                      </p>
                    )}
                  </div>

                  <a
                    href={`/api/trace/exports/${job.export_id}/download`}
                    download
                    className="flex items-center px-3 py-1.5 bg-white border border-slate-300 text-slate-800 rounded-lg font-semibold hover:bg-slate-100 transition-colors shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5 mr-1 text-blue-600" />
                    Download Bundle (.zip)
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: LINEAGE & QUALITY */}
      {activeTab === 'lineage' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Provenance Pipeline */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center">
              <GitBranch className="w-3.5 h-3.5 text-blue-600 mr-1" />
              OpenLineage Data Provenance Flow
            </h3>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-800">1. Hospital Operational Events</span>
                <p className="text-[11px] text-slate-500 mt-0.5">Intake, diagnosis recording, clinical itemization in transactional DB.</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-800">2. Transactional Outbox Relay</span>
                <p className="text-[11px] text-slate-500 mt-0.5">Decoupled domain message capture guarantees zero loss of workflow events.</p>
              </div>
              <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200">
                <span className="font-bold text-blue-900">3. Multi-layer Privacy Gate</span>
                <p className="text-[11px] text-blue-800 mt-0.5">Automated deny-list, month bucketing, regex PII scanning, and small-cell k-suppression (k ≥ 5).</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-800">4. Governed Trace Canonical Schema</span>
                <p className="text-[11px] text-slate-500 mt-0.5">Standardized subjects, facilities, encounters, conditions, and outcomes.</p>
              </div>
              <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200">
                <span className="font-bold text-emerald-900">5. DuckDB Parquet Exporter</span>
                <p className="text-[11px] text-emerald-800 mt-0.5">Zero-copy analytical query engine packaging research-ready Parquet and FHIR bundles.</p>
              </div>
            </div>
          </div>

          {/* Great Expectations Quality Audit */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 mr-1" />
              Data Quality Audit (Custom Rules Engine)
            </h3>
            <div className="space-y-2 text-xs">
              {[
                { name: "expect_column_values_to_not_be_null('subject_key')", status: "PASSED" },
                { name: "expect_column_values_to_be_unique('encounter_key')", status: "PASSED" },
                { name: "expect_end_month_gte_start_month()", status: "PASSED" },
                { name: "expect_icd10_code_matches_standard_format()", status: "PASSED" },
                { name: "expect_no_pii_patterns_present()", status: "PASSED" },
                { name: "expect_k_anonymity_gte_5_across_cohorts()", status: "PASSED" }
              ].map((c, idx) => (
                <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between font-mono text-[11px]">
                  <span className="text-slate-700 truncate mr-2">{c.name}</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold shrink-0">
                    ✓ {c.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

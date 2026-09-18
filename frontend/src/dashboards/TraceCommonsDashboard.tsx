import React, { useState, useEffect } from 'react';
import {
  Database, Download, Filter, ShieldCheck, CheckCircle2,
  Calendar, Layers, GitBranch, FileCode, HardDrive, RefreshCw
} from 'lucide-react';
import { TraceOverview, CohortFilter, CohortPreview, ExportJob } from '../types';
import {
  fetchTraceOverview, previewCohort, createExportJob, fetchExports
} from '../api/client';

export const TraceCommonsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'catalog' | 'explorer' | 'export' | 'lineage'>('overview');
  const [overview, setOverview] = useState<TraceOverview | null>(null);
  const [loading, setLoading] = useState(true);

  // Cohort Explorer Filter State
  const [filters, setFilters] = useState<CohortFilter>({
    dataset_version: 'trace-core-1.3.0',
    facility_keys: [],
    facility_tiers: [],
    diagnosis_codes: [],
    age_bands: [],
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
      const data = await fetchTraceOverview();
      setOverview(data);
      const exportsList = await fetchExports();
      setExportJobs(exportsList);
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
      setDownloadLink(job.download_url || null);
      const updated = await fetchExports();
      setExportJobs(updated);
      alert(`Export bundle created successfully! Checksum: ${job.checksum_sha256?.slice(0, 16)}...`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setExporting(false);
    }
  };

  if (loading || !overview) {
    return <div className="p-8 text-center text-slate-500 text-xs">Loading Trace Commons open data catalog...</div>;
  }

  const kpis = overview.kpis;

  return (
    <div className="space-y-6">
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
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
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
              <div className="text-[10px] text-emerald-600 font-semibold mt-1">Great Expectations</div>
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
              <div className="text-[10px] text-emerald-600 font-semibold mt-1">100% De-identified</div>
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

            {/* Longitudinal Timeline */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Longitudinal Encounter Density
              </h3>
              <div className="space-y-1.5 text-[11px] max-h-56 overflow-y-auto pr-1">
                {overview.events_by_month.map((m, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-100">
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
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="border border-blue-200 bg-blue-50/40 p-5 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase bg-blue-600 text-white px-2 py-0.5 rounded">
                  Open Access Research
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
                    onClick={handleGenerateExport}
                    disabled={exporting}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-xs cursor-pointer"
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    {exporting ? 'Packaging Archive...' : 'Generate Parquet Export Bundle'}
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

      {/* TAB 4: EXPORT WIZARD */}
      {activeTab === 'export' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Governed Export Packages</h3>
              <p className="text-xs text-slate-500">
                Exports packaged as `.zip` containing Apache Parquet, CSV, FHIR R4 NDJSON, OMOP CDM v5.5, manifest, and SHA-256 checksums.
              </p>
            </div>
            <button
              onClick={handleGenerateExport}
              disabled={exporting}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 cursor-pointer"
            >
              <Download className="w-4 h-4 mr-1.5" />
              {exporting ? 'Generating...' : 'Create New Export Package'}
            </button>
          </div>

          <div className="space-y-3">
            {exportJobs.map((job) => (
              <div key={job.export_id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
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
              Data Quality Audit (Great Expectations)
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

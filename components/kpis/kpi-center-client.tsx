"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CalendarDays, RefreshCw, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiBulkUpdateModal } from "@/components/kpis/kpi-bulk-update-modal";
import { KpiCard } from "@/components/kpis/kpi-card";
import { KpiRadarDashboard } from "@/components/kpis/kpi-radar-dashboard";
import { KpiTargetsModal } from "@/components/kpis/kpi-targets-modal";
import { OperationsWorkspace } from "@/components/kpis/operations-workspace";
import { ProductsWorkspace } from "@/components/kpis/products-workspace";
import { ShareLinkPanel } from "@/components/kpis/share-link-panel";
import { SimpleSectionWorkspace } from "@/components/kpis/simple-section-workspace";
import { findPeriodOption, getCurrentKpiPeriod, getPeriodOptions, type KpiPeriodOption } from "@/lib/kpis/periods";
import { getValueForKpi } from "@/lib/kpis/status";
import { fetchKpiDefinitions, fetchKpiValues, fetchKpiYearValues, kpiKeys, type KpiShareLinkSafe, type ProjectPerformanceRecord, type SimpleWorkspaceKind, type SimpleWorkspaceRecord } from "@/lib/queries/kpis";
import type { IndicatorProduct, KpiDefinition, KpiPeriodType, KpiValue, Profile, Project } from "@/lib/supabase/types";

interface Props {
  currentUser: Profile;
  initialDefinitions: KpiDefinition[];
  initialValues: KpiValue[];
  initialYearValues: KpiValue[];
  initialShareLinks: KpiShareLinkSafe[];
  initialProducts: IndicatorProduct[];
  initialProjects: Pick<Project, "id" | "name" | "manager_id" | "total_budget" | "progress">[];
  initialProjectUpdates: ProjectPerformanceRecord[];
  initialSimpleWorkspaces: Record<SimpleWorkspaceKind, SimpleWorkspaceRecord[]>;
  initialPeriod: KpiPeriodOption;
}

const EXECUTIVE_TAB = "النظرة التنفيذية";
const REVENUE_TAB = "الإيرادات";
const CLIENTS_TAB = "العقود والعملاء";
const AUDIENCE_TAB = "الجمهور والمشتركين";
const OPERATIONS_TAB = "العمليات والمشاريع";
const SERVICES_TAB = "البرامج والخدمات";
const PRODUCTS_TAB = "المنتجات";
const PARTNERSHIPS_TAB = "الشراكات والتموضع";

const TABS = [
  EXECUTIVE_TAB,
  REVENUE_TAB,
  CLIENTS_TAB,
  AUDIENCE_TAB,
  OPERATIONS_TAB,
  SERVICES_TAB,
  PRODUCTS_TAB,
  PARTNERSHIPS_TAB,
];

export function KpiCenterClient({
  currentUser,
  initialDefinitions,
  initialValues,
  initialYearValues,
  initialShareLinks,
  initialProducts,
  initialProjects,
  initialProjectUpdates,
  initialSimpleWorkspaces,
  initialPeriod,
}: Props) {
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [periodType, setPeriodType] = useState<KpiPeriodType>(initialPeriod.periodType);
  const [periodStart, setPeriodStart] = useState(initialPeriod.periodStart);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [targetsOpen, setTargetsOpen] = useState(false);

  const periodOptions = useMemo(() => getPeriodOptions(periodType), [periodType]);
  const selectedPeriod = findPeriodOption(periodType, periodStart);

  const { data: definitions = initialDefinitions } = useQuery({
    queryKey: kpiKeys.definitions(),
    queryFn: fetchKpiDefinitions,
    initialData: initialDefinitions,
  });

  const isInitialPeriod = selectedPeriod.periodStart === initialPeriod.periodStart && selectedPeriod.periodType === initialPeriod.periodType;
  const selectedYear = Number(selectedPeriod.periodStart.slice(0, 4));
  const isInitialYear = selectedYear === Number(initialPeriod.periodStart.slice(0, 4));

  const { data: values = [], isFetching } = useQuery({
    queryKey: kpiKeys.values(periodType, selectedPeriod.periodStart, selectedPeriod.periodEnd),
    queryFn: () => fetchKpiValues(periodType, selectedPeriod.periodStart, selectedPeriod.periodEnd),
    initialData: isInitialPeriod ? initialValues : undefined,
    placeholderData: [],
  });

  const { data: yearValues = [], isFetching: isFetchingYearValues } = useQuery({
    queryKey: kpiKeys.yearValues(selectedYear),
    queryFn: () => fetchKpiYearValues(selectedYear),
    initialData: isInitialYear ? initialYearValues : undefined,
    placeholderData: [],
  });

  const isAdmin = currentUser.role === "admin";
  const radarDefinitions = useMemo(
    () => isAdmin ? definitions : definitions.filter((definition) => definition.perspective !== REVENUE_TAB),
    [definitions, isAdmin]
  );
  const visibleSections = useMemo(
    () => TABS.filter((tab) => {
      if (tab === REVENUE_TAB) return isAdmin;
      if ([EXECUTIVE_TAB, CLIENTS_TAB, AUDIENCE_TAB, PRODUCTS_TAB, OPERATIONS_TAB, SERVICES_TAB, PARTNERSHIPS_TAB].includes(tab)) return true;
      return definitions.some((item) => item.perspective === tab);
    }),
    [definitions, isAdmin]
  );

  const changePeriodType = (nextType: KpiPeriodType) => {
    const nextPeriod = getCurrentKpiPeriod(nextType);
    setPeriodType(nextType);
    setPeriodStart(nextPeriod.periodStart);
  };

  const renderSection = (section: string) => {
    const simpleKind = getSimpleKind(section);
    if (simpleKind) {
      return (
        <SimpleSectionWorkspace
          kind={simpleKind}
          section={section}
          currentUser={currentUser}
          definitions={definitions}
          initialRecords={isInitialPeriod ? initialSimpleWorkspaces[simpleKind] : []}
          periodType={periodType}
          periodStart={selectedPeriod.periodStart}
          periodEnd={selectedPeriod.periodEnd}
        />
      );
    }

    if (section === PRODUCTS_TAB) {
      return (
        <ProductsWorkspace
          currentUser={currentUser}
          definitions={definitions}
          initialProducts={initialProducts}
          periodType={periodType}
          periodStart={selectedPeriod.periodStart}
          periodEnd={selectedPeriod.periodEnd}
        />
      );
    }

    if (section === OPERATIONS_TAB) {
      return (
        <OperationsWorkspace
          currentUser={currentUser}
          definitions={definitions}
          initialProjects={initialProjects}
          initialUpdates={isInitialPeriod ? initialProjectUpdates : []}
          periodType={periodType}
          periodStart={selectedPeriod.periodStart}
          periodEnd={selectedPeriod.periodEnd}
        />
      );
    }

    const sectionDefinitions = definitions.filter((definition) => definition.perspective === section);
    if (sectionDefinitions.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
          لا توجد مؤشرات متاحة لهذا القسم حسب صلاحيتك الحالية.
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">{section}</h2>
              <p className="mt-1 text-sm text-slate-500">لوحة متابعة مختصرة للمؤشرات المرتبطة بهذا المنظور.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600">
              {sectionDefinitions.length} مؤشر
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sectionDefinitions.map((definition) => (
            <KpiCard key={definition.id} definition={definition} value={getValueForKpi(values, definition.id)} periodType={periodType} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-indigo-600">
                <BarChart3 size={18} />
                مركز المؤشرات
              </div>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">مركز مؤشرات سماوة 2026</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                مساحة تنفيذية لمتابعة مؤشرات الشركة حسب المنظورات، مع مساحات عمل عميقة للمنتجات والعمليات والمشاريع.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="grid grid-cols-2 gap-2 sm:w-[360px]">
                <Select value={periodType} onValueChange={(value) => changePeriodType(value as KpiPeriodType)}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="نوع الفترة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">شهري</SelectItem>
                    <SelectItem value="quarterly">ربع سنوي</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={periodStart} onValueChange={setPeriodStart}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="الفترة" />
                  </SelectTrigger>
                  <SelectContent>
                    {periodOptions.map((period) => (
                      <SelectItem key={period.periodStart} value={period.periodStart}>
                        {period.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isAdmin && activeTab !== EXECUTIVE_TAB && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="outline" onClick={() => setTargetsOpen(true)}>
                    <Target size={16} />
                    تعديل المستهدفات
                  </Button>
                  <Button onClick={() => setBulkOpen(true)}>
                    <CalendarDays size={16} />
                    تحديث المؤشرات اليدوية
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {isAdmin && <ShareLinkPanel initialLinks={initialShareLinks} />}

        {isFetching && (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
            <RefreshCw size={14} className="animate-spin" />
            يتم تحديث بيانات الفترة...
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
          <TabsList className="h-auto flex-wrap justify-start gap-1 rounded-xl bg-slate-100 p-1">
            {visibleSections.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="rounded-lg px-4 py-2">
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={EXECUTIVE_TAB} className="mt-6">
            <KpiRadarDashboard
              definitions={radarDefinitions}
              values={values}
              yearValues={yearValues}
              periodType={periodType}
              periodLabel={selectedPeriod.label}
              year={selectedYear}
              isFetching={isFetching || isFetchingYearValues}
              isAdmin={isAdmin}
              onOpenBulkUpdate={() => setBulkOpen(true)}
              onOpenTargets={() => setTargetsOpen(true)}
              onOpenWorkspace={setActiveTab}
            />
          </TabsContent>

          {TABS.filter((tab) => tab !== EXECUTIVE_TAB).map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-6">
              {renderSection(tab)}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <KpiBulkUpdateModal
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        definitions={definitions}
        values={values}
        currentUserId={currentUser.id}
        periodType={periodType}
        periodStart={selectedPeriod.periodStart}
        periodEnd={selectedPeriod.periodEnd}
        periodLabel={selectedPeriod.label}
      />
      <KpiTargetsModal open={targetsOpen} onOpenChange={setTargetsOpen} definitions={definitions} />
    </>
  );
}

function getSimpleKind(section: string): SimpleWorkspaceKind | null {
  if (section === REVENUE_TAB) return "revenue";
  if (section === CLIENTS_TAB) return "clients";
  if (section === AUDIENCE_TAB) return "audience";
  if (section === SERVICES_TAB) return "services";
  if (section === PARTNERSHIPS_TAB) return "partnerships";
  return null;
}

"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiBulkUpdateModal } from "@/components/kpis/kpi-bulk-update-modal";
import { KpiRadarDashboard } from "@/components/kpis/kpi-radar-dashboard";
import { KpiTargetsModal } from "@/components/kpis/kpi-targets-modal";
import { ShareLinkPanel } from "@/components/kpis/share-link-panel";
import { findPeriodOption, getCurrentKpiPeriod, getPeriodOptions, type KpiPeriodOption } from "@/lib/kpis/periods";
import {
  fetchKpiDefinitions,
  fetchKpiValues,
  fetchKpiYearValues,
  kpiKeys,
  type KpiShareLinkSafe,
} from "@/lib/queries/kpis";
import type { KpiDefinition, KpiPeriodType, KpiValue, Profile } from "@/lib/supabase/types";

interface Props {
  currentUser: Profile;
  initialDefinitions: KpiDefinition[];
  initialValues: KpiValue[];
  initialYearValues: KpiValue[];
  initialShareLinks: KpiShareLinkSafe[];
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

type BulkScope = {
  section?: string;
  definitionId?: string;
} | null;

export function KpiCenterClient({
  currentUser,
  initialDefinitions,
  initialValues,
  initialYearValues,
  initialShareLinks,
  initialPeriod,
}: Props) {
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [periodType, setPeriodType] = useState<KpiPeriodType>(initialPeriod.periodType);
  const [periodStart, setPeriodStart] = useState(initialPeriod.periodStart);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [bulkScope, setBulkScope] = useState<BulkScope>(null);

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
      if (tab === EXECUTIVE_TAB) return true;
      return radarDefinitions.some((item) => item.perspective === tab);
    }),
    [isAdmin, radarDefinitions]
  );

  const modalDefinitions = useMemo(() => {
    if (bulkScope?.definitionId) return definitions.filter((definition) => definition.id === bulkScope.definitionId);
    if (bulkScope?.section) return definitions.filter((definition) => definition.perspective === bulkScope.section);
    return definitions;
  }, [bulkScope, definitions]);

  const modalScopeLabel = useMemo(() => {
    if (bulkScope?.definitionId) return modalDefinitions[0]?.name;
    return bulkScope?.section;
  }, [bulkScope, modalDefinitions]);

  const changePeriodType = (nextType: KpiPeriodType) => {
    const nextPeriod = getCurrentKpiPeriod(nextType);
    setPeriodType(nextType);
    setPeriodStart(nextPeriod.periodStart);
  };

  const openBulkUpdate = (section?: string) => {
    setBulkScope(section ? { section } : null);
    setBulkOpen(true);
  };

  const openIndicatorUpdate = (definitionId: string) => {
    setBulkScope({ definitionId });
    setBulkOpen(true);
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
              <h1 className="mt-2 text-3xl font-extrabold text-slate-950">مركز مؤشرات سماوة 2026</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                لوحة موحدة لمتابعة مؤشرات الشركة: رادار عام، تبويبات للأقسام، وبطاقات قابلة للتحديث المباشر حسب الفترة.
              </p>
            </div>

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
              onOpenBulkUpdate={() => openBulkUpdate()}
              onOpenTargets={() => setTargetsOpen(true)}
              onEditIndicator={openIndicatorUpdate}
            />
          </TabsContent>

          {visibleSections.filter((tab) => tab !== EXECUTIVE_TAB).map((tab) => {
            const sectionDefinitions = radarDefinitions.filter((definition) => definition.perspective === tab);
            return (
              <TabsContent key={tab} value={tab} className="mt-6">
                {sectionDefinitions.length > 0 ? (
                  <KpiRadarDashboard
                    definitions={sectionDefinitions}
                    values={values}
                    yearValues={yearValues}
                    periodType={periodType}
                    periodLabel={selectedPeriod.label}
                    year={selectedYear}
                    isFetching={isFetching || isFetchingYearValues}
                    isAdmin={isAdmin}
                    scopePerspective={tab}
                    onOpenBulkUpdate={() => openBulkUpdate(tab)}
                    onOpenTargets={() => setTargetsOpen(true)}
                    onEditIndicator={openIndicatorUpdate}
                  />
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
                    لا توجد مؤشرات متاحة لهذا القسم حسب صلاحيتك الحالية.
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      <KpiBulkUpdateModal
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        definitions={modalDefinitions}
        values={values}
        currentUserId={currentUser.id}
        periodType={periodType}
        periodStart={selectedPeriod.periodStart}
        periodEnd={selectedPeriod.periodEnd}
        periodLabel={selectedPeriod.label}
        scopeLabel={modalScopeLabel}
      />
      <KpiTargetsModal open={targetsOpen} onOpenChange={setTargetsOpen} definitions={definitions} />
    </>
  );
}

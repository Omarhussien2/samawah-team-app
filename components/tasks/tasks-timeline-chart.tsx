"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  differenceInCalendarDays,
  eachMonthOfInterval,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  max,
  min,
  startOfMonth,
} from "date-fns";
import { ar } from "date-fns/locale";
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Filter,
  Search,
  Sparkles,
  Target,
  User,
  X,
} from "lucide-react";
import { TaskModal } from "@/components/tasks/task-modal";
import { cn, getPriorityLabel, getStatusLabel } from "@/lib/utils";
import { createSearchMatcher } from "@/lib/utils/search";
import type { TaskWithRelations } from "@/lib/queries/tasks";
import type { Profile } from "@/lib/supabase/types";

const MIN_DAY_WIDTH = 24;
const ROW_HEIGHT = 104;
const HEADER_HEIGHT = 92;

const statusOptions = ["Backlog", "To Do", "In Progress", "Review", "Done", "Cancelled"];
const priorityOptions = ["critical", "high", "medium", "low"];

const taskAccent = [
  { line: "#06b6d4", bg: "rgba(6, 182, 212, 0.08)", soft: "rgba(6, 182, 212, 0.18)" },
  { line: "#22c55e", bg: "rgba(34, 197, 94, 0.08)", soft: "rgba(34, 197, 94, 0.18)" },
  { line: "#f97316", bg: "rgba(249, 115, 22, 0.08)", soft: "rgba(249, 115, 22, 0.18)" },
  { line: "#ef4444", bg: "rgba(239, 68, 68, 0.08)", soft: "rgba(239, 68, 68, 0.18)" },
  { line: "#6366f1", bg: "rgba(99, 102, 241, 0.08)", soft: "rgba(99, 102, 241, 0.18)" },
];

type TimelineItem = {
  task: TaskWithRelations;
  start: Date;
  end: Date;
  ownerName: string;
};

interface Props {
  tasks: TaskWithRelations[];
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url">[];
  className?: string;
}

function parseDay(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toInputDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function clampNumber(value: number, minValue: number, maxValue: number) {
  return Math.min(maxValue, Math.max(minValue, value));
}

function getTimelineDefaults(items: TimelineItem[]) {
  const today = new Date();
  if (items.length === 0) {
    return {
      start: addDays(today, -14),
      end: addDays(today, 45),
    };
  }

  const starts = items.map((item) => item.start);
  const ends = items.map((item) => item.end);
  return {
    start: addDays(min(starts), -7),
    end: addDays(max(ends), 14),
  };
}

function getTaskDates(task: TaskWithRelations): { start: Date; end: Date } | null {
  const fallbackCreated = parseDay(task.created_at);
  const start = parseDay(task.start_date) ?? parseDay(task.due_date) ?? fallbackCreated;
  if (!start) return null;

  const rawEnd = parseDay(task.due_date) ?? parseDay(task.start_date) ?? start;
  const end = isBefore(rawEnd, start) ? start : rawEnd;
  return { start, end };
}

function intersects(item: TimelineItem, start: Date, end: Date) {
  return !isBefore(item.end, start) && !isAfter(item.start, end);
}

function getRangeButtonDates(range: string, items: TimelineItem[]) {
  const today = new Date();
  if (range === "all") return getTimelineDefaults(items);

  const days = Number(range);
  return {
    start: addDays(today, -7),
    end: addDays(today, days),
  };
}

export function TasksTimelineChart({ tasks, profiles, className }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [zoom, setZoom] = useState("normal");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const timelineItems = useMemo<TimelineItem[]>(() => {
    return tasks
      .map((task) => {
        const dates = getTaskDates(task);
        if (!dates) return null;

        return {
          task,
          start: dates.start,
          end: dates.end,
          ownerName: task.owner?.full_name ?? task.owner_name ?? "بدون مسؤول",
        };
      })
      .filter((item): item is TimelineItem => Boolean(item))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [tasks]);

  const defaultRange = useMemo(() => getTimelineDefaults(timelineItems), [timelineItems]);
  const [rangeStart, setRangeStart] = useState(() => toInputDate(defaultRange.start));
  const [rangeEnd, setRangeEnd] = useState(() => toInputDate(defaultRange.end));

  useEffect(() => {
    if (timelineItems.length === 0) return;
    setRangeStart((current) => current || toInputDate(defaultRange.start));
    setRangeEnd((current) => current || toInputDate(defaultRange.end));
  }, [defaultRange.end, defaultRange.start, timelineItems.length]);

  const viewStart = parseDay(rangeStart) ?? defaultRange.start;
  const viewEndRaw = parseDay(rangeEnd) ?? defaultRange.end;
  const viewEnd = isBefore(viewEndRaw, viewStart) ? viewStart : viewEndRaw;
  const dayCount = Math.max(1, differenceInCalendarDays(viewEnd, viewStart) + 1);
  const dayWidth = zoom === "compact" ? MIN_DAY_WIDTH : zoom === "wide" ? 54 : 38;
  const chartWidth = Math.max(960, dayCount * dayWidth);
  const todayOffset = differenceInCalendarDays(new Date(), viewStart) * dayWidth;
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks]
  );

  const activeFilterCount = [search, ownerId, status, priority].filter(Boolean).length;
  const filteredItems = useMemo(() => {
    const matchesSearch = createSearchMatcher(search);
    return timelineItems.filter((item) => {
      const task = item.task;
      if (!intersects(item, viewStart, viewEnd)) return false;
      if (ownerId && task.owner_id !== ownerId) return false;
      if (status && task.status !== status) return false;
      if (priority && task.priority !== priority) return false;
      return matchesSearch([
        task.title,
        task.sub_task,
        task.category,
        item.ownerName,
        task.project?.name,
        getStatusLabel(task.status),
        getPriorityLabel(task.priority),
      ]);
    });
  }, [ownerId, priority, search, status, timelineItems, viewEnd, viewStart]);

  const monthTicks = useMemo(() => {
    return eachMonthOfInterval({ start: viewStart, end: viewEnd }).map((month) => {
      const tickStart = max([startOfMonth(month), viewStart]);
      const tickEnd = min([endOfMonth(month), viewEnd]);
      const startOffset = differenceInCalendarDays(tickStart, viewStart) * dayWidth;
      const width = (differenceInCalendarDays(tickEnd, tickStart) + 1) * dayWidth;
      return { label: format(month, "MMM", { locale: ar }), startOffset, width };
    });
  }, [dayWidth, viewEnd, viewStart]);

  const dayTicks = useMemo(() => {
    return Array.from({ length: dayCount }, (_, index) => addDays(viewStart, index)).filter((_, index) => index % 7 === 0);
  }, [dayCount, viewStart]);

  const resetFilters = () => {
    setSearch("");
    setOwnerId("");
    setStatus("");
    setPriority("");
  };

  const applyRange = (range: string) => {
    const next = getRangeButtonDates(range, timelineItems);
    setRangeStart(toInputDate(next.start));
    setRangeEnd(toInputDate(next.end));
  };

  const scrollByDays = (direction: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: direction * 420, behavior: "smooth" });
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث في المخطط..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-9 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
            {search && (
              <button
                type="button"
                aria-label="مسح البحث"
                onClick={() => setSearch("")}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <select
            value={ownerId}
            onChange={(event) => setOwnerId(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">كل المسؤولين</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.full_name ?? profile.id}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">كل الحالات</option>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {getStatusLabel(option)}
              </option>
            ))}
          </select>

          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">كل الأولويات</option>
            {priorityOptions.map((option) => (
              <option key={option} value={option}>
                {getPriorityLabel(option)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => resetFilters()}
            disabled={activeFilterCount === 0}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Filter size={15} />
            تصفية
            {activeFilterCount > 0 && <span className="rounded-full bg-indigo-600 px-1.5 text-[10px] text-white">{activeFilterCount}</span>}
          </button>
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button type="button" onClick={() => scrollByDays(-1)} className="rounded-md p-2 text-slate-600 hover:bg-white" title="تحريك لليسار">
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={() => scrollByDays(1)} className="rounded-md p-2 text-slate-600 hover:bg-white" title="تحريك لليمين">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {[
            ["30", "٣٠ يوم"],
            ["90", "٣ أشهر"],
            ["180", "٦ أشهر"],
            ["all", "كل المدة"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => applyRange(value)}
              className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <CalendarDays size={14} />
            من
            <input
              type="date"
              value={rangeStart}
              onChange={(event) => setRangeStart(event.target.value)}
              className="h-9 rounded-lg border border-slate-200 px-2 text-xs text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            إلى
            <input
              type="date"
              value={rangeEnd}
              onChange={(event) => setRangeEnd(event.target.value)}
              className="h-9 rounded-lg border border-slate-200 px-2 text-xs text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <select
            value={zoom}
            onChange={(event) => setZoom(event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="compact">مضغوط</option>
            <option value="normal">متوسط</option>
            <option value="wide">تفصيلي</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <div>
            <h3 className="text-sm font-black text-slate-800">المخطط الزمني للمهام</h3>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
              يعرض {filteredItems.length} من {timelineItems.length} مهمة حسب تاريخ البداية والنهاية
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500">
            <span className="inline-flex items-center gap-1"><CircleDot size={12} className="text-cyan-500" /> البداية</span>
            <span className="inline-flex items-center gap-1"><Target size={12} className="text-red-500" /> التسليم</span>
          </div>
        </div>

        <div ref={scrollRef} dir="ltr" className="max-h-[680px] overflow-auto bg-[#f8fafc]">
          <div className="relative" style={{ width: chartWidth, minHeight: HEADER_HEIGHT + Math.max(filteredItems.length, 1) * ROW_HEIGHT }}>
            <div className="sticky top-0 z-20 h-[92px] border-b border-slate-200 bg-[#f8fafc]/95 backdrop-blur">
              <div className="relative h-full">
                {monthTicks.map((tick) => (
                  <div
                    key={`${tick.label}-${tick.startOffset}`}
                    className="absolute top-5 border-l border-dashed border-slate-300/80 pl-3 text-left text-xs font-black uppercase tracking-wide text-slate-500"
                    style={{ left: tick.startOffset, width: tick.width }}
                  >
                    {tick.label}
                  </div>
                ))}
                {dayTicks.map((day) => {
                  const left = differenceInCalendarDays(day, viewStart) * dayWidth;
                  return (
                    <div key={day.toISOString()} className="absolute top-14 text-center text-xs font-medium text-slate-400" style={{ left, width: dayWidth }}>
                      {format(day, "d", { locale: ar })}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="absolute inset-x-0 top-[92px] bottom-0">
              {dayTicks.map((day) => {
                const left = differenceInCalendarDays(day, viewStart) * dayWidth;
                return <div key={`grid-${day.toISOString()}`} className="absolute top-0 h-full border-l border-dashed border-slate-200" style={{ left }} />;
              })}
              {todayOffset >= 0 && todayOffset <= chartWidth && (
                <div className="absolute top-0 z-10 h-full border-l border-red-400/70" style={{ left: todayOffset }}>
                  <span className="absolute -left-8 top-3 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600 ring-1 ring-red-100">اليوم</span>
                </div>
              )}
            </div>

            <div
              className="relative z-10 pt-3"
              style={{ height: Math.max(256, filteredItems.length * ROW_HEIGHT + 12) }}
            >
              {filteredItems.length === 0 ? (
                <div className="flex h-64 items-center justify-center" dir="rtl">
                  <div className="text-center">
                    <AlertCircle className="mx-auto mb-3 text-slate-300" size={32} />
                    <p className="text-sm font-bold text-slate-500">لا توجد مهام مطابقة للنطاق أو الفلاتر</p>
                  </div>
                </div>
              ) : (
                filteredItems.map((item, index) => {
                  const accent = taskAccent[index % taskAccent.length];
                  const startOffset = clampNumber(differenceInCalendarDays(item.start, viewStart) * dayWidth, 0, chartWidth);
                  const endOffset = clampNumber((differenceInCalendarDays(item.end, viewStart) + 1) * dayWidth, 0, chartWidth);
                  const width = Math.max(dayWidth * 1.5, endOffset - startOffset);
                  const progress = clampNumber(item.task.progress ?? (item.task.status === "Done" ? 100 : 0), 0, 100);
                  const titleWidth = Math.max(180, Math.min(width + 130, 420));
                  const midpoint = width / 2;

                  return (
                    <button
                      key={item.task.id}
                      type="button"
                      onClick={() => setSelectedTaskId(item.task.id)}
                      className="group absolute left-0 right-0 text-left outline-none"
                      style={{ top: index * ROW_HEIGHT + 12, height: ROW_HEIGHT }}
                    >
                      <span
                        className="absolute top-3 flex items-center gap-2 text-slate-800"
                        style={{ left: startOffset, width: titleWidth }}
                        dir="rtl"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md" style={{ color: accent.line }}>
                          <Sparkles size={14} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black">{item.task.title}</span>
                          <span className="mt-0.5 flex items-center gap-1 truncate text-[10px] font-semibold text-slate-500">
                            <User size={10} />
                            {item.ownerName}
                          </span>
                        </span>
                      </span>

                      <span
                        className="absolute top-[48px] h-7 overflow-hidden rounded-[5px] border bg-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition group-hover:-translate-y-0.5 group-hover:shadow-md"
                        style={{
                          left: startOffset,
                          width,
                          borderColor: `${accent.line}55`,
                          background: `linear-gradient(90deg, ${accent.bg} 0%, ${accent.bg} ${progress}%, transparent ${progress}%, transparent 100%)`,
                        }}
                      >
                        <span
                          className="absolute inset-y-0 left-0 border-r border-dashed"
                          style={{ width: `${progress}%`, borderColor: `${accent.line}66`, backgroundColor: accent.soft }}
                        />
                        {progress < 100 && (
                          <span
                            className="absolute inset-y-0 right-0 border border-dashed opacity-70"
                            style={{ left: `${progress}%`, borderColor: `${accent.line}55`, backgroundColor: "transparent" }}
                          />
                        )}
                      </span>

                      {[
                        { left: 0, label: "بداية", color: accent.line },
                        { left: midpoint, label: item.task.category ?? "مرحلة", color: "#64748b" },
                        { left: width, label: "تسليم", color: "#ef4444" },
                      ].map((mark, markIndex) => (
                        <span
                          key={`${item.task.id}-${markIndex}`}
                          className="absolute top-[58px]"
                          style={{ left: startOffset + mark.left }}
                        >
                          <span
                            className="block h-2 w-2 -translate-x-1 rotate-45 rounded-[1px] border bg-[#f8fafc]"
                            style={{ borderColor: mark.color }}
                          />
                          <span className="mt-4 block -translate-x-1/2 truncate text-[10px] font-semibold text-slate-400" style={{ maxWidth: 120 }} dir="rtl">
                            {mark.label}
                          </span>
                        </span>
                      ))}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          profiles={profiles}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}

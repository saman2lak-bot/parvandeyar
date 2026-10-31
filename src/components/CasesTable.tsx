import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Filter,
  Loader2,
  MessageSquareText,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import type { Case } from "../lib/demoData";
import {
  hasWarningNote,
  toPersianDigits,
  toSearchText,
  warningPattern,
} from "../lib/format";
import SelectMenu, { type SelectOption } from "./SelectMenu";

export type StatusFilter =
  | "all"
  | "open"
  | "completed"
  | "noexpert"
  | "warning";

const PAGE_SIZES = [10, 25, 50] as const;

/** Builds a compact page list (1 … current-1 current current+1 … last). */
function buildPageNumbers(
  current: number,
  total: number,
): Array<number | "ellipsis"> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("ellipsis");
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < total - 1) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

const openCount = (item: Case) =>
  item.deficiencies.filter((deficiency) => !deficiency.resolved).length;

/** «نیازمند پیگیری» پرونده‌ای است که هنوز تکمیل نشده است. */
const needsFollowUp = (item: Case) => item.completion < 100;
/** پرونده‌ای که در توضیحاتش واژه «اخطار» آمده و هنوز تکمیل نشده است. */
const isWarningFollowUp = (item: Case) =>
  needsFollowUp(item) && hasWarningNote(item.description);

/** Highlights every «اخطار» inside the note text so the keyword is easy to spot. */
function renderNoteText(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(warningPattern())) {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(text.slice(cursor, start));
    nodes.push(
      <mark className="case-note-mark" key={`warning-${start}`}>
        {match[0]}
      </mark>,
    );
    cursor = start + match[0].length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

export function filterCases(
  cases: Case[],
  query: string,
  status: StatusFilter,
) {
  const term = toSearchText(query);
  return cases.filter((item) => {
    const matchesQuery =
      !term ||
      toSearchText(
        `${item.number}${item.name}${item.phone}${item.expert}${item.description ?? ""}`,
      ).includes(term);
    const matchesStatus =
      status === "all" ||
      (status === "open" && needsFollowUp(item)) ||
      (status === "completed" && item.completion === 100) ||
      (status === "noexpert" && item.expert.includes("بدون کارشناس")) ||
      (status === "warning" && isWarningFollowUp(item));
    return matchesQuery && matchesStatus;
  });
}

type Props = {
  cases: Case[];
  query: string;
  onQueryChange: (value: string) => void;
  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  onOpen: (item: Case) => void;
  loading?: boolean;
  title?: string;
  subtitle?: string;
};

export default function CasesTable({
  cases,
  query,
  onQueryChange,
  status,
  onStatusChange,
  onOpen,
  loading,
  title = "آخرین پرونده‌ها",
  subtitle = "نمایش آخرین پرونده‌های به‌روزرسانی شده",
}: Props) {
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [page, setPage] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const list = useMemo(
    () => filterCases(cases, query, status),
    [cases, query, status],
  );
  // Tally of cases whose description contains «اخطار» (shown in the legend).
  const warningStats = useMemo(
    () => ({
      all: cases.filter((item) => hasWarningNote(item.description)).length,
      followUp: cases.filter(isWarningFollowUp).length,
    }),
    [cases],
  );
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = list.slice(startIndex, startIndex + pageSize);
  const rangeStart = list.length === 0 ? 0 : startIndex + 1;
  const rangeEnd = Math.min(startIndex + pageSize, list.length);

  // Any change in search, filter or page size starts again from the first page.
  useEffect(() => {
    setPage(1);
  }, [query, status, pageSize]);
  // Keep the current page valid when rows are deleted or the list shrinks.
  useEffect(() => {
    setPage((current) => (current > totalPages ? totalPages : current));
  }, [totalPages]);
  // A new page always starts from the first row of the scroll container.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [currentPage, pageSize]);

  return (
    <div className="panel table">
      <h2>
        {title}
        <small>{subtitle}</small>
      </h2>
      <div className="tools">
        <div className={`search${query ? " has-value" : ""}`}>
          <span className="search-icon" aria-hidden="true"><Search size={15} /></span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="جست‌وجو در شماره، نام یا تلفن..."
            aria-label="جست‌وجوی پرونده"
          />
          {query && (
            <button
              type="button"
              className="search-clear"
              aria-label="پاک کردن جست‌وجو"
              onClick={() => onQueryChange("")}
            >
              <X size={13} aria-hidden="true" />
            </button>
          )}
        </div>
        <SelectMenu
          value={status}
          onChange={onStatusChange}
          label="فیلتر وضعیت پرونده"
          icon={<Filter size={14} />}
          options={[
            { value: "all", label: "همه وضعیت‌ها" },
            { value: "open", label: "نیازمند پیگیری", icon: <CircleX size={13} /> },
            {
              value: "warning",
              label: "دارای اخطار",
              icon: <TriangleAlert size={13} />,
              count:
                warningStats.followUp > 0
                  ? toPersianDigits(warningStats.followUp)
                  : undefined,
            },
            { value: "completed", label: "تکمیل‌شده", icon: <CircleCheck size={13} /> },
            { value: "noexpert", label: "بدون کارشناس", icon: <Filter size={13} /> },
          ] satisfies SelectOption<StatusFilter>[]}
        />
        <span className="result-count">
          {toPersianDigits(list.length)} پرونده
        </span>
      </div>
      <div
        className={`table-notice${warningStats.all > 0 ? " has-warning" : ""}`}
        role="note"
      >
        <span className="table-notice-icon" aria-hidden="true">
          <TriangleAlert size={15} />
        </span>
        <p className="table-notice-text">
          <b>معنای «اخطار»:</b> اگر در توضیحات یک پرونده واژه «اخطار» ثبت شده
          باشد، یعنی کارشناس برای آن پرونده هشدار یا نکته‌ای در نظر گرفته است و باید
          بررسی بیشتری روی آن انجام شود.
        </p>
        {warningStats.followUp > 0 && (
          <span className="table-notice-count">
            {toPersianDigits(warningStats.followUp)} پرونده با اخطار
          </span>
        )}
      </div>
      <div className="table-scroll" ref={scrollRef}>
        <table>
          <thead>
            <tr>
              <th>شماره پرونده</th>
              <th>بیمه‌گذار</th>
              <th>کارشناس</th>
              <th>وضعیت نقص</th>
              <th>درصد تکمیل</th>
              <th>آخرین تغییر</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="empty-row">
                  <Loader2 className="spin" size={15} /> در حال دریافت
                  پرونده‌ها...
                </td>
              </tr>
            )}
            {!loading && list.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-row">
                  {status === "warning"
                    ? "هیچ پرونده نیازمند پیگیری‌ای با واژه «اخطار» در توضیحات پیدا نشد."
                    : cases.length === 0
                      ? "هنوز پرونده‌ای ثبت نشده است. با دکمه «ثبت پرونده جدید» شروع کنید."
                      : "پرونده‌ای با این مشخصات یافت نشد."}
                </td>
              </tr>
            )}
            {!loading &&
              pageItems.map((item) => {
                const note = item.description?.trim();
                const warning = hasWarningNote(note);
                return (
                  <Fragment key={item.id}>
                    <tr
                      className={`case-row${warning ? " is-warning" : ""}${note ? " has-note" : ""}`}
                      onClick={() => onOpen(item)}
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onOpen(item);
                        }
                      }}
                    >
                      <td>
                        <b>{item.number}</b>
                        <small>{item.status}</small>
                      </td>
                      <td>
                        {item.name}
                        <small>{item.phone}</small>
                      </td>
                      <td>{item.expert}</td>
                      <td>
                        <button
                          type="button"
                          className={
                            item.completion === 100 ? "defSucsess" : "def"
                          }
                          onClick={() => onOpen(item)}
                        >
                          {item.completion === 100 ? (
                            <CircleCheck aria-hidden="true" />
                          ) : (
                            <CircleX aria-hidden="true" />
                          )}
                          <span>
                            {item.completion === 100
                              ? "پرداخت شد"
                              : `${toPersianDigits(openCount(item))} نقص دارد`}
                          </span>
                        </button>
                      </td>
                      <td>
                        <div className="bar">
                          <i style={{ width: `${item.completion}%` }} />
                        </div>
                        {toPersianDigits(item.completion)}٪
                      </td>
                      <td>{item.updated}</td>
                    </tr>
                    {note && (
                      <tr
                        className={`case-note${warning ? " is-warning" : ""}`}
                        onClick={() => onOpen(item)}
                      >
                        <td colSpan={6}>
                          <div className="case-note-inner">
                            <span className="case-note-icon" aria-hidden="true">
                              {warning ? (
                                <TriangleAlert size={13} />
                              ) : (
                                <MessageSquareText size={13} />
                              )}
                            </span>
                            <span className="case-note-text">
                              <b className="case-note-label">
                                {warning ? "توضیحات (اخطار)" : "توضیحات"}:
                              </b>{" "}
                              {renderNoteText(note)}
                            </span>
                            {warning && (
                              <span className="case-note-tag">
                                نیازمند بررسی
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
          </tbody>
        </table>
      </div>
      {!loading && list.length > 0 && (
        <div className="pagination">
          <span className="pagination-info">
            نمایش {toPersianDigits(rangeStart)} تا {toPersianDigits(rangeEnd)}{" "}
            از {toPersianDigits(list.length)} پرونده
          </span>
          <label className="page-size">
            تعداد در صفحه
            <span className="page-size-select">
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                aria-label="تعداد سطر در هر صفحه"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {toPersianDigits(size)}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} aria-hidden="true" />
            </span>
          </label>
          {totalPages > 1 && (
            <div
              className="pager"
              role="navigation"
              aria-label="صفحه‌بندی پرونده‌ها"
            >
              <button
                type="button"
                className="page-btn"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage === 1}
                aria-label="صفحه قبل"
              >
                <ChevronRight size={14} />
              </button>
              {buildPageNumbers(currentPage, totalPages).map((item, index) =>
                item === "ellipsis" ? (
                  <span className="page-ellipsis" key={`ellipsis-${index}`}>
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    className={
                      "page-btn" + (item === currentPage ? " active" : "")
                    }
                    onClick={() => setPage(item)}
                    aria-label={`صفحه ${toPersianDigits(item)}`}
                    aria-current={item === currentPage ? "page" : undefined}
                  >
                    {toPersianDigits(item)}
                  </button>
                ),
              )}
              <button
                type="button"
                className="page-btn"
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                disabled={currentPage === totalPages}
                aria-label="صفحه بعد"
              >
                <ChevronLeft size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

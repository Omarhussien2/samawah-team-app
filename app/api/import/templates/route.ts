import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { getImportTemplateConfig } from "@/lib/import/template-config";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get("type");
  const config = getImportTemplateConfig(type);
  const workbook = XLSX.utils.book_new();

  const instructions = [
    ["القالب", config.title],
    [],
    ["التعليمات"],
    ...config.instructions.map((instruction) => [instruction]),
    [],
    ["الأعمدة المطلوبة"],
    config.columns,
  ];

  const dataSheet = XLSX.utils.aoa_to_sheet([config.columns]);
  const sampleSheet = XLSX.utils.json_to_sheet([config.sample], { header: config.columns });
  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);

  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "تعليمات");
  XLSX.utils.book_append_sheet(workbook, dataSheet, "بيانات الاستيراد");
  XLSX.utils.book_append_sheet(workbook, sampleSheet, "مثال");

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${config.filename}"`,
    },
  });
}

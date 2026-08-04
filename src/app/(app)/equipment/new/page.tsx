import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { EquipmentForm } from "../equipment-forms";
export const metadata: Metadata = { title: "Add equipment" };
export default function NewEquipmentPage() { return <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8"><PageHeader description="Track owned equipment and its current hour meter." title="Add equipment" /><EquipmentForm /></div>; }

"use client";

import { CheckCircle2 } from "lucide-react";
import { useActionState, useState } from "react";
import { FormFeedback } from "@/components/form-feedback";
import type { MileageLeg } from "@/lib/domain/mileage";
import { formatDate } from "@/lib/format";
import type { MileageTrip } from "@/lib/repositories/mileage-repository";
import { approveMileageTrips, type MileageState } from "./actions";

function LegRow({ tripId, leg }: { tripId: number; leg: MileageLeg }) {
  return <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
    <span className="text-muted">{leg.from} → {leg.to}</span>
    {leg.miles === null
      ? <input className="h-9 w-28 rounded-md border border-line-strong bg-surface px-2 text-right" min="0" name={`distance:${tripId}:${leg.seq}`} placeholder="miles" required step="0.1" type="number" />
      : <span className="font-semibold tabular-nums">{leg.miles.toFixed(1)} mi</span>}
  </div>;
}

export function MileageApprovalForm({ trips }: { trips: MileageTrip[] }) {
  const [selected, setSelected] = useState(() => new Set(trips.map((trip) => trip.id)));
  const [state, action, pending] = useActionState(approveMileageTrips, {} as MileageState);
  const allSelected = trips.length > 0 && selected.size === trips.length;
  return <form action={action} className="space-y-4">
    <label className="inline-flex items-center gap-2 font-semibold"><input checked={allSelected} onChange={(event) => setSelected(event.target.checked ? new Set(trips.map((trip) => trip.id)) : new Set())} type="checkbox" />Select all</label>
    <div className="space-y-3">
      {trips.map((trip) => <div className="rounded-lg border border-line bg-surface p-4 shadow-sm" key={trip.id}>
        <label className="flex items-start gap-3">
          <input checked={selected.has(trip.id)} name="tripIds" onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(trip.id); else next.delete(trip.id); return next; })} type="checkbox" value={trip.id} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{trip.purpose}</p>
              <span className="text-sm font-semibold tabular-nums">{formatDate(trip.trip_date)} · {trip.total_miles.toFixed(1)} mi</span>
            </div>
            {trip.needs_manual_distance && <p className="mt-1 text-xs text-danger">One or more legs need a distance before this trip can be approved.</p>}
            <div className="mt-2 divide-y divide-line border-t border-line pt-1">
              {(trip.legs as MileageLeg[]).map((leg) => <LegRow key={leg.seq} leg={leg} tripId={trip.id} />)}
            </div>
          </div>
        </label>
      </div>)}
      {!trips.length && <p className="py-8 text-center text-muted">No mileage trips are waiting for review.</p>}
    </div>
    <FormFeedback message={state.message} tone={state.message?.startsWith("Approved") ? "success" : "danger"} />
    {trips.length > 0 && <button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending || selected.size === 0}><CheckCircle2 size={17} />{pending ? "Approving..." : `Approve ${selected.size} selected`}</button>}
  </form>;
}

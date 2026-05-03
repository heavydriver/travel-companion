import DateTimePicker from "@react-native-community/datetimepicker";
import { CalendarDays, MapPin, PlaneTakeoff, Wallet } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Button } from "@/components/shared/Button";
import { IOSDateTimePickerModal } from "@/components/shared/IOSDateTimePickerModal";
import { formatDate, formatDateRange } from "@/lib/utils";
import {
  applyProposalDateWindow,
  deriveProposalRange,
  type PlannerProposal,
  plannerProposalToItineraryPreview,
  plannerProposalToTripPreview,
} from "@/llm/plannerSchema";

function ProposalDateField({
  label,
  value,
  onPress,
}: {
  label: string;
  value: Date;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 rounded-2xl border border-border bg-background px-3 py-3"
    >
      <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Text>
      <Text className="mt-2 text-sm font-semibold text-foreground">{formatDate(value)}</Text>
    </Pressable>
  );
}

function ProposalActionDatePicker({
  visible,
  title,
  value,
  minimumDate,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  value: Date;
  minimumDate?: Date;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
}) {
  if (!visible) {
    return null;
  }

  if (Platform.OS === "ios") {
    return (
      <IOSDateTimePickerModal
        visible={visible}
        title={title}
        value={value}
        mode="date"
        minimumDate={minimumDate}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );
  }

  return (
    <DateTimePicker
      value={value}
      mode="date"
      minimumDate={minimumDate}
      display="default"
      onChange={(_, date) => {
        onCancel();
        if (date) {
          onConfirm(date);
        }
      }}
    />
  );
}

function normalizeForCompare(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sameDestinationName(left?: string | null, right?: string | null) {
  return Boolean(left && right && normalizeForCompare(left) === normalizeForCompare(right));
}

function parseIsoDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function atStartOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function tripCoversDateRange(
  trip: { startDate: string; endDate: string },
  startDate: Date,
  endDate: Date,
) {
  const tripStart = parseIsoDate(trip.startDate);
  const tripEnd = parseIsoDate(trip.endDate);
  if (!tripStart || !tripEnd) return false;
  return (
    atStartOfDay(startDate) >= atStartOfDay(tripStart) &&
    atStartOfDay(endDate) <= atStartOfDay(tripEnd)
  );
}

export function PlannerProposalCard({
  proposal,
  activeTrip,
  isConnected,
  creating,
  addingToItinerary,
  onCreateTrip,
  onAddToCurrentTrip,
}: {
  proposal: PlannerProposal;
  activeTrip: {
    title: string;
    startDate: string;
    endDate: string;
    destination: { name: string };
  } | null;
  isConnected: boolean;
  creating: boolean;
  addingToItinerary: boolean;
  onCreateTrip: (proposal: PlannerProposal) => void;
  onAddToCurrentTrip?: (proposal: PlannerProposal) => void;
}) {
  const initialRange = useMemo(() => deriveProposalRange(proposal), [proposal]);
  const [startDate, setStartDate] = useState<Date>(initialRange.startDate ?? new Date());
  const [endDate, setEndDate] = useState<Date>(
    initialRange.endDate ?? initialRange.startDate ?? new Date(),
  );
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    const nextStart = initialRange.startDate ?? new Date();
    const nextEnd = initialRange.endDate ?? initialRange.startDate ?? nextStart;
    setStartDate(nextStart);
    setEndDate(nextEnd);
  }, [initialRange.endDate, initialRange.startDate]);

  const adjustedProposal = useMemo(
    () => applyProposalDateWindow(proposal, startDate, endDate),
    [endDate, proposal, startDate],
  );
  const tripPreview = useMemo(
    () => plannerProposalToTripPreview(adjustedProposal),
    [adjustedProposal],
  );
  const itineraryPreview = useMemo(
    () => plannerProposalToItineraryPreview(adjustedProposal),
    [adjustedProposal],
  );

  const canCreateTrip = Boolean(
    tripPreview.title &&
      tripPreview.destinationName &&
      tripPreview.startDate &&
      tripPreview.endDate,
  );
  const canAddToCurrentTrip =
    Boolean(activeTrip) &&
    sameDestinationName(activeTrip?.destination.name, tripPreview.destinationName) &&
    (activeTrip ? tripCoversDateRange(activeTrip, startDate, endDate) : false);

  return (
    <View className="mt-3 w-full rounded-3xl border border-border bg-card p-4">
      <View className="flex-row items-center gap-2">
        <PlaneTakeoff size={18} color="#208AEF" />
        <Text className="flex-1 text-base font-semibold text-foreground">Trip Preview</Text>
      </View>

      <View className="mt-4 rounded-2xl border border-border bg-background px-4 py-4">
        <Text className="text-lg font-semibold text-foreground">{tripPreview.title}</Text>

        <View className="mt-3 gap-2">
          <View className="flex-row items-center gap-2">
            <MapPin size={15} color="#64748B" />
            <Text className="text-sm text-foreground">
              {tripPreview.destinationName}
              {tripPreview.country ? `, ${tripPreview.country}` : ""}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <CalendarDays size={15} color="#64748B" />
            <Text className="text-sm text-foreground">
              {formatDateRange(tripPreview.startDate, tripPreview.endDate)}
            </Text>
          </View>

          {tripPreview.budget != null ? (
            <View className="flex-row items-center gap-2">
              <Wallet size={15} color="#64748B" />
              <Text className="text-sm text-foreground">
                {tripPreview.currencyCode ? `${tripPreview.currencyCode} ` : ""}
                {tripPreview.budget}
              </Text>
            </View>
          ) : null}
        </View>

        {tripPreview.description ? (
          <Text className="mt-4 text-sm leading-6 text-foreground">{tripPreview.description}</Text>
        ) : null}
      </View>

      <Text className="mt-3 text-xs text-muted-foreground">
        Plan ready. Adjust dates if needed, then create the trip or add these items to your
        itinerary.
      </Text>

      <View className="mt-4 flex-row gap-3">
        <ProposalDateField
          label="Start"
          value={startDate}
          onPress={() => setShowStartPicker(true)}
        />
        <ProposalDateField label="End" value={endDate} onPress={() => setShowEndPicker(true)} />
      </View>

      <ProposalActionDatePicker
        visible={showStartPicker}
        title="Plan Start Date"
        value={startDate}
        onCancel={() => setShowStartPicker(false)}
        onConfirm={(date) => {
          setShowStartPicker(false);
          setStartDate(date);
          if (date > endDate) {
            setEndDate(date);
          }
        }}
      />
      <ProposalActionDatePicker
        visible={showEndPicker}
        title="Plan End Date"
        value={endDate}
        minimumDate={startDate}
        onCancel={() => setShowEndPicker(false)}
        onConfirm={(date) => {
          setShowEndPicker(false);
          setEndDate(date);
        }}
      />

      <View className="mt-4 rounded-2xl border border-border bg-background px-4 py-4">
        <Text className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Itinerary Items
        </Text>
        <Text className="mt-1 text-xs text-muted-foreground">
          {itineraryPreview.length} planned item{itineraryPreview.length === 1 ? "" : "s"}
        </Text>

        <View className="mt-3 gap-3">
          {itineraryPreview.map((item) => (
            <View key={item.id} className="rounded-2xl bg-muted/40 px-3 py-3">
              <View className="flex-row items-start justify-between gap-3">
                <Text className="flex-1 text-sm font-semibold text-foreground">{item.title}</Text>
                <Text className="text-xs text-muted-foreground">
                  {item.startTime
                    ? `${item.startTime}${item.endTime ? ` - ${item.endTime}` : ""}`
                    : "Flexible"}
                </Text>
              </View>
              <Text className="mt-1 text-xs text-muted-foreground">{formatDate(item.date)}</Text>
              {item.notes ? (
                <Text className="mt-2 text-sm leading-5 text-foreground">{item.notes}</Text>
              ) : null}
            </View>
          ))}
        </View>
      </View>

      {proposal.followUpQuestions.length ? (
        <View className="mt-4 rounded-2xl bg-background px-3 py-3">
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Still Needed
          </Text>
          {proposal.followUpQuestions.map((question) => (
            <Text key={question} className="mt-2 text-sm text-foreground">
              - {question}
            </Text>
          ))}
        </View>
      ) : null}

      <Button
        label={isConnected ? "Create Trip & Itinerary" : "Save Trip Offline"}
        onPress={() => onCreateTrip(adjustedProposal)}
        loading={creating}
        disabled={!canCreateTrip}
        className="mt-4"
      />

      {activeTrip ? (
        <Button
          label={isConnected ? "Add Items to Current Itinerary" : "Add Items Requires Internet"}
          onPress={() => onAddToCurrentTrip?.(adjustedProposal)}
          loading={addingToItinerary}
          disabled={!isConnected || !canAddToCurrentTrip}
          variant="secondary"
          className="mt-3"
        />
      ) : null}

      {activeTrip && !canAddToCurrentTrip ? (
        <Text className="mt-3 text-xs text-muted-foreground">
          Add-to-itinerary is available when your active trip matches {tripPreview.destinationName}{" "}
          and covers this date range.
        </Text>
      ) : null}
    </View>
  );
}

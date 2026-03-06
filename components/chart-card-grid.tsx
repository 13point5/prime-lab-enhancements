"use client";

import * as React from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent, UniqueIdentifier } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ChartCardGridItem = {
  id: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  content: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

type ChartCardGridProps = {
  items: ChartCardGridItem[];
  className?: string;
  columnsClassName?: string;
};

function reconcileOrder(
  currentOrder: UniqueIdentifier[],
  nextOrder: UniqueIdentifier[],
): UniqueIdentifier[] {
  const nextSet = new Set(nextOrder);
  const preserved = currentOrder.filter((id) => nextSet.has(id));
  const additions = nextOrder.filter((id) => !preserved.includes(id));
  return [...preserved, ...additions];
}

function SortableChartCard({
  item,
  sortable,
}: {
  item: ChartCardGridItem;
  sortable: boolean;
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: item.id,
    disabled: !sortable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleLabel =
    typeof item.title === "string" && item.title.trim().length > 0 ? item.title : "chart card";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/chart-card rounded-lg border border-zinc-800 bg-zinc-950/60 p-2.5",
        isDragging && "z-10 border-zinc-700 shadow-[0_0_0_1px_rgba(161,161,170,0.25)]",
        item.className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-zinc-200">{item.title}</p>
          {item.subtitle ? <p className="text-xs text-zinc-500">{item.subtitle}</p> : null}
        </div>

        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:pointer-events-none sm:group-hover/chart-card:opacity-100 sm:group-hover/chart-card:pointer-events-auto sm:group-focus-within/chart-card:opacity-100 sm:group-focus-within/chart-card:pointer-events-auto">
          {item.actions}
          {sortable ? (
            <Button
              ref={setActivatorNodeRef}
              variant="secondary"
              size="icon-xs"
              className="size-6 touch-none cursor-grab bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 active:cursor-grabbing"
              aria-label={`Drag ${handleLabel}`}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-2">{item.content}</div>
    </div>
  );
}

export function ChartCardGrid({
  items,
  className,
  columnsClassName = "md:grid-cols-2 xl:grid-cols-3",
}: ChartCardGridProps) {
  const itemIds = React.useMemo(() => items.map((item) => item.id), [items]);
  const [orderedIds, setOrderedIds] = React.useState<UniqueIdentifier[]>(itemIds);

  React.useEffect(() => {
    setOrderedIds((currentOrder) => reconcileOrder(currentOrder, itemIds));
  }, [itemIds]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const itemsById = React.useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );
  const orderedItems = orderedIds
    .map((id) => itemsById.get(String(id)))
    .filter((item): item is ChartCardGridItem => item !== undefined);
  const sortable = orderedItems.length > 1;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    setOrderedIds((currentOrder) => {
      const activeIndex = currentOrder.indexOf(active.id);
      const overIndex = currentOrder.indexOf(over.id);

      if (activeIndex === -1 || overIndex === -1) {
        return currentOrder;
      }

      return arrayMove(currentOrder, activeIndex, overIndex);
    });
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
        <div className={cn("grid gap-3", columnsClassName, className)}>
          {orderedItems.map((item) => (
            <SortableChartCard key={item.id} item={item} sortable={sortable} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

import { ActivityIndicator, Pressable, Text } from "react-native";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "items-center justify-center rounded-xl px-4 py-3 active:opacity-90",
  {
    variants: {
      variant: {
        primary: "bg-primary",
        secondary: "bg-card border border-border",
        ghost: "bg-transparent",
      },
      size: {
        md: "min-h-12",
        lg: "min-h-14",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

const labelVariants = cva("text-base font-semibold", {
  variants: {
    variant: {
      primary: "text-primary-foreground",
      secondary: "text-foreground",
      ghost: "text-muted-foreground",
    },
  },
  defaultVariants: {
    variant: "primary",
  },
});

type ButtonProps = VariantProps<typeof buttonVariants> & {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
};

export function Button({
  label,
  onPress,
  disabled,
  loading,
  className,
  variant,
  size,
}: ButtonProps) {
  const isDisabled = Boolean(disabled || loading);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      className={cn(
        buttonVariants({ variant, size }),
        isDisabled && "opacity-50",
        className
      )}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "white" : undefined} />
      ) : (
        <Text className={labelVariants({ variant })}>{label}</Text>
      )}
    </Pressable>
  );
}

declare module "approximate-number" {
  export interface ApproximateNumberOptions {
    capital?: boolean;
    decimal?: boolean;
    min10k?: boolean;
    prefix?: string;
    separator?: boolean | string;
    suffix?: string;
  }

  export function approximateNumber(
    value: number,
    options?: ApproximateNumberOptions
  ): string;
}

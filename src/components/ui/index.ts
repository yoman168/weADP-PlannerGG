/**
 * The UI primitives the WE-ADK screens use, copied from the ProductFlow design
 * system (shadcn-style, Radix + Tailwind). Mirrors that package's barrel so
 * imports read exactly as they did in the monorepo.
 */
export { cn } from './lib/cn';
export { Button, buttonVariants, type ButtonProps } from './button';
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card';
export { Badge, badgeVariants, type BadgeProps } from './badge';
export { Switch, type SwitchProps } from './switch';
export { Progress } from './progress';
export { Textarea } from './textarea';
export { Input } from './input';
export { Label } from './label';
export { Separator } from './separator';
export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from './select';
export { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

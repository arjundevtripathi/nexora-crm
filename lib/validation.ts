import { z } from 'zod';
export const stages=['Lead','Qualified','Proposal','Negotiation','Won','Lost'] as const;
const short=z.string().trim().min(1).max(160);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'Invalid date');
export const contactSchema=z.object({name:short,email:z.string().trim().email().max(254),company:short,phone:z.string().trim().max(40).default(''),status:z.enum(['Lead','Customer','Partner']).default('Lead'),notes:z.string().max(4000).default('')}).strict();
export const dealSchema=z.object({name:short,company:short,value:z.number().finite().min(0).max(100000000000),stage:z.enum(stages),closeDate:date,notes:z.string().max(4000).default('')}).strict();
export const taskSchema=z.object({name:short,company:z.string().trim().max(160).default(''),dueDate:date,priority:z.enum(['High','Medium','Low']),completed:z.boolean().default(false),notes:z.string().max(4000).default('')}).strict();
export const schemas={contacts:contactSchema,deals:dealSchema,tasks:taskSchema};
export const mutationSchema=z.object({kind:z.enum(['contacts','deals','tasks']),id:z.string().uuid().optional(),version:z.number().int().positive().optional(),data:z.unknown().optional()}).strict();

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { eventContent, embedText } from '@/lib/mongo';
import { pool } from '@/lib/mysql';
import { apiError, sameOrigin, validationError } from '@/lib/http';
import type { RowDataPacket } from 'mysql2';

export const runtime = 'nodejs';
const schema=z.object({eventId:z.number().int().positive(),title:z.string().trim().min(3).max(200),description:z.string().trim().min(10).max(5000),tags:z.array(z.string().trim().min(1).max(40)).max(20),published:z.boolean().default(false)});

export async function GET(){
  try{const collection=await eventContent();const docs=await collection.find({published:true},{projection:{vector:0}}).sort({updatedAt:-1}).toArray();return NextResponse.json({content:docs})}
  catch(error){return apiError(error)}
}
export async function POST(request:Request){
  if(!sameOrigin(request))return NextResponse.json({error:'Cross-origin request rejected.'},{status:403});
  const user=await currentUser();if(!user)return NextResponse.json({error:'Sign in required.'},{status:401});
  if(user.role!=='ADMIN')return NextResponse.json({error:'Organizer access required.'},{status:403});
  const parsed=schema.safeParse(await request.json());if(!parsed.success)return validationError(parsed.error.issues[0]?.message??'Invalid event content');
  try{
    const [events]=await pool.execute<RowDataPacket[]>('SELECT event_id FROM Events WHERE event_id=?',[parsed.data.eventId]);
    if(!events.length)return NextResponse.json({error:'Event not found in SQL database.'},{status:404});
    const content=parsed.data;const collection=await eventContent();
    const result=await collection.insertOne({...content,vector:embedText(`${content.title} ${content.description} ${content.tags.join(' ')}`),updatedAt:new Date()});
    return NextResponse.json({id:result.insertedId.toHexString()},{status:201});
  }catch(error){return apiError(error)}
}

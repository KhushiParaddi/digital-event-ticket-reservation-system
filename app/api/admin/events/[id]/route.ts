import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { pool } from '@/lib/mysql';
import { apiError, sameOrigin } from '@/lib/http';
import { eventContent } from '@/lib/mongo';

export const runtime = 'nodejs';
const updateSchema = z.object({ title:z.string().trim().min(3).max(200).optional(), dateTime:z.string().datetime().optional(), organizer:z.string().trim().min(2).max(160).optional() }).refine(value=>Object.keys(value).length>0);
async function admin() {
  const user=await currentUser();
  if(!user)return {response:NextResponse.json({error:'Sign in required.'},{status:401})};
  if(user.role!=='ADMIN')return {response:NextResponse.json({error:'Organizer access required.'},{status:403})};
  return {user};
}
export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
  if(!sameOrigin(request))return NextResponse.json({error:'Cross-origin request rejected.'},{status:403});
  const access=await admin();if(access.response)return access.response;
  const id=Number((await context.params).id);if(!Number.isSafeInteger(id)||id<=0)return NextResponse.json({error:'Invalid event id.'},{status:400});
  const parsed=updateSchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:'Invalid event update.'},{status:400});
  const fields=parsed.data;const sets:string[]=[];const values:(string|number|Date)[]=[];
  if(fields.dateTime&&new Date(fields.dateTime).getTime()<=Date.now())return NextResponse.json({error:'Event date must be in the future.'},{status:400});
  if(fields.title){sets.push('title=?');values.push(fields.title)}
  if(fields.dateTime){sets.push('date_time=?');values.push(new Date(fields.dateTime))}
  if(fields.organizer){sets.push('organizer_name=?');values.push(fields.organizer)}
  try{const [result]=await pool.query('UPDATE Events SET '+sets.join(',')+' WHERE event_id=?',[...values,id]);
    if((result as {affectedRows:number}).affectedRows===0)return NextResponse.json({error:'Event not found.'},{status:404});
    return NextResponse.json({ok:true});
  }catch(error){return apiError(error)}
}
export async function DELETE(request:Request,context:{params:Promise<{id:string}>}){
  if(!sameOrigin(request))return NextResponse.json({error:'Cross-origin request rejected.'},{status:403});
  const access=await admin();if(access.response)return access.response;
  const id=Number((await context.params).id);if(!Number.isSafeInteger(id)||id<=0)return NextResponse.json({error:'Invalid event id.'},{status:400});
  const connection=await pool.getConnection();
  try{
    await connection.beginTransaction();
    const [bookings]=await connection.execute('SELECT b.booking_id FROM Bookings b JOIN Tickets t ON t.ticket_id=b.ticket_id WHERE t.event_id=? LIMIT 1',[id]);
    if((bookings as unknown[]).length){await connection.rollback();return NextResponse.json({error:'Events with bookings cannot be deleted.'},{status:409})}
    await connection.execute('DELETE FROM Tickets WHERE event_id=?',[id]);
    const [result]=await connection.execute('DELETE FROM Events WHERE event_id=?',[id]);
    if((result as {affectedRows:number}).affectedRows===0){await connection.rollback();return NextResponse.json({error:'Event not found.'},{status:404})}
    await connection.commit();
    try { await (await eventContent()).deleteOne({eventId:id}); } catch (error) { console.error('Could not remove event content from MongoDB',error); }
    return NextResponse.json({ok:true});
  }catch(error){await connection.rollback();return apiError(error)}finally{connection.release()}
}

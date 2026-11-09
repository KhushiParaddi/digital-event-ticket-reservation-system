import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const base=(process.env.APP_URL??'http://127.0.0.1:3000').replace(/\/$/,'');
const adminEmail='aarav@example.com';
const adminPassword=process.env.DEMO_ADMIN_PASSWORD??'AdminDemo2026!';
const customerPassword=process.env.DEMO_CUSTOMER_PASSWORD??'CustomerDemo2026!';
const email=`smoke-${Date.now()}@example.test`;
const password=`Smoke-${Date.now()}-Strong!`;
let customerCookie='',adminCookie='',createdEventId=0,contentId='',createdBookingId=0;
const checks=[];
async function request(path,{method='GET',body,cookie}={}){
  const response=await fetch(`${base}${path}`,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(cookie?{cookie}: {})},body:body?JSON.stringify(body):undefined});
  const data=await response.json().catch(()=>({}));
  return {response,data};
}
async function login(targetEmail,targetPassword){
  const {response,data}=await request('/api/auth/login',{method:'POST',body:{email:targetEmail,password:targetPassword}});
  assert.equal(response.status,200,`login failed for ${targetEmail}: ${JSON.stringify(data)}`);
  const cookie=response.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie,'auth cookie missing');return cookie;
}
const sql=await mysql.createConnection({host:process.env.MYSQL_HOST??'127.0.0.1',port:Number(process.env.MYSQL_PORT??3306),user:process.env.MYSQL_USER??'event_app',password:process.env.MYSQL_PASSWORD??'local_app_password',database:process.env.MYSQL_DATABASE??'event_ticket_reservation'});
try{
  let {response,data}=await request('/api/events');assert.equal(response.status,200);assert.ok(data.events.length>=5);checks.push('public event SELECT');
  ({response}=await request('/api/bookings',{method:'POST',body:{ticketId:1,quantity:1,paymentMode:'UPI'}}));assert.equal(response.status,401);checks.push('unauthenticated booking is blocked');

  ({response,data}=await request('/api/auth/register',{method:'POST',body:{name:'Smoke Test',email,password}}));assert.equal(response.status,201,JSON.stringify(data));customerCookie=response.headers.get('set-cookie')?.split(';')[0]??'';assert.ok(customerCookie);checks.push('customer registration and session');
  ({response}=await request('/api/admin/events',{method:'POST',cookie:customerCookie,body:{}}));assert.equal(response.status,403);checks.push('customer cannot use organizer API');

  adminCookie=await login(adminEmail,adminPassword);
  const eventDate=new Date(Date.now()+45*86400000).toISOString();
  ({response,data}=await request('/api/admin/events',{method:'POST',cookie:adminCookie,body:{title:'Smoke Test Event',category:'Music',dateTime:eventDate,venueId:1,organizer:'Smoke Test',tickets:[{name:'Test Ticket',price:120,seats:20}]}}));
  assert.equal(response.status,201,JSON.stringify(data));createdEventId=Number(data.eventId);checks.push('organizer creates SQL event');

  ({response,data}=await request('/api/event-content',{method:'POST',cookie:adminCookie,body:{eventId:createdEventId,title:'Smoke Music Night',description:'An integration smoke fixture for live jazz and music recommendations.',tags:['smoke','jazz','music'],published:true}}));
  assert.equal(response.status,201,JSON.stringify(data));contentId=data.id;checks.push('MongoDB create');
  ({response,data}=await request('/api/event-content'));assert.equal(response.status,200);assert.ok(data.content.some(item=>item._id===contentId));checks.push('MongoDB read');
  ({response}=await request(`/api/event-content/${contentId}`,{method:'PATCH',cookie:adminCookie,body:{description:'Updated smoke fixture for live jazz and music recommendations.',tags:['smoke','jazz','music','updated']}}));assert.equal(response.status,200);checks.push('MongoDB update');
  ({response,data}=await request('/api/recommendations?q=live%20jazz%20music'));assert.equal(response.status,200);assert.ok(data.recommendations.some(item=>item.eventId===createdEventId));checks.push('MongoDB vector recommendation');
  ({response}=await request(`/api/event-content/${contentId}`,{method:'DELETE',cookie:adminCookie}));assert.equal(response.status,200);contentId='';checks.push('MongoDB delete');

  ({response}=await request(`/api/admin/events/${createdEventId}`,{method:'PATCH',cookie:adminCookie,body:{title:'Smoke Test Event Updated'}}));assert.equal(response.status,200);checks.push('organizer updates SQL event');
  ({response,data}=await request('/api/events'));assert.equal(response.status,200);
  const event=data.events.find(item=>item.id===createdEventId);assert.ok(event);assert.equal(event.title,'Smoke Test Event Updated');assert.equal(event.tickets[0].seats,20);

  const candidate=data.events.flatMap(item=>item.tickets.map(ticket=>({event:item,ticket}))).find(item=>item.ticket.seats>0);
  assert.ok(candidate,'sample ticket inventory missing');
  ({response,data}=await request('/api/bookings',{method:'POST',cookie:customerCookie,body:{ticketId:candidate.ticket.id,quantity:1,paymentMode:'UPI'}}));assert.equal(response.status,201,JSON.stringify(data));createdBookingId=Number(data.bookingId);checks.push('stored procedure booking, payment, and inventory trigger');
  ({response,data}=await request('/api/bookings',{cookie:customerCookie}));assert.equal(response.status,200);assert.ok(data.bookings.some(item=>item.id===createdBookingId));
  ({response}=await request(`/api/bookings/${createdBookingId}`,{method:'DELETE',cookie:customerCookie}));assert.equal(response.status,200);checks.push('stored procedure cancellation and inventory restore');
  ({response,data}=await request('/api/events'));assert.equal(response.status,200);
  const after=data.events.flatMap(item=>item.tickets).find(ticket=>ticket.id===candidate.ticket.id);assert.equal(after.seats,candidate.ticket.seats);

  const [revenue]=await sql.query('SELECT fn_event_revenue(?) AS revenue',[candidate.event.id]);assert.ok(Number(revenue[0].revenue)>=0);checks.push('SQL revenue function');
  const [categories]=await sql.query(`WITH RECURSIVE category_tree AS (
    SELECT category_id,parent_category_id,name,0 AS depth FROM Categories WHERE parent_category_id IS NULL
    UNION ALL SELECT c.category_id,c.parent_category_id,c.name,ct.depth+1 FROM Categories c JOIN category_tree ct ON c.parent_category_id=ct.category_id
  ) SELECT COUNT(*) AS count FROM category_tree`);assert.ok(Number(categories[0].count)>=5);checks.push('recursive category CTE');

  ({response}=await request(`/api/admin/events/${createdEventId}`,{method:'DELETE',cookie:adminCookie}));assert.equal(response.status,200);createdEventId=0;checks.push('organizer deletes SQL event');
  console.log(`Passed ${checks.length} integration checks:\n- ${checks.join('\n- ')}`);
}finally{
  if(contentId&&adminCookie)await request(`/api/event-content/${contentId}`,{method:'DELETE',cookie:adminCookie}).catch(()=>{});
  if(createdEventId&&adminCookie)await request(`/api/admin/events/${createdEventId}`,{method:'DELETE',cookie:adminCookie}).catch(()=>{});
  if(createdBookingId){await sql.execute('DELETE FROM Payments WHERE booking_id=?',[createdBookingId]);await sql.execute('DELETE FROM Bookings WHERE booking_id=?',[createdBookingId]);}
  await sql.execute('DELETE FROM Users WHERE email=?',[email]);
  await sql.end();
}

const events = [
  {id:1,title:'Monsoon Indie Night',category:'Music',city:'Bengaluru',venue:'Indiranagar Open Arena',days:30,tiers:[{id:1,name:'General',price:499,seats:500},{id:2,name:'VIP',price:1499,seats:100}]},
  {id:2,title:'Design Futures Summit',category:'Conference',city:'Pune',venue:'Riverside Convention Hall',days:45,tiers:[{id:3,name:'Standard',price:799,seats:400},{id:4,name:'Delegate',price:1999,seats:80}]},
  {id:3,title:'Chennai Laugh Festival',category:'Comedy',city:'Chennai',venue:'Coastal Arts Centre',days:60,tiers:[{id:5,name:'General',price:399,seats:300},{id:6,name:'Front Row',price:999,seats:60}]},
  {id:4,title:'Kolkata Food and Music Fair',category:'Festival',city:'Kolkata',venue:'City Music Grounds',days:75,tiers:[{id:7,name:'Day Pass',price:599,seats:900},{id:8,name:'Weekend Pass',price:1299,seats:300}]},
  {id:5,title:'Pune Jazz Weekend',category:'Music',city:'Pune',venue:'Riverside Convention Hall',days:90,tiers:[{id:9,name:'General',price:699,seats:350},{id:10,name:'Lounge',price:1799,seats:70}]}
];
const inventoryKey='evently-demo-inventory-v1';
const bookingsKey='evently-demo-bookings-v1';
const initialInventory=Object.fromEntries(events.flatMap(event=>event.tiers.map(tier=>[tier.id,tier.seats])));
let inventory=readStore(inventoryKey,initialInventory);
let bookings=readStore(bookingsKey,[]);
let selectedEvent=null;
let toastTimer;
const eventList=document.querySelector('#event-list');
const bookingList=document.querySelector('#booking-list');
const dialog=document.querySelector('#booking-dialog');
const ticketSelect=document.querySelector('#ticket-type');
const quantityInput=document.querySelector('#ticket-quantity');
const cityFilter=document.querySelector('#city-filter');

function readStore(key,fallback){try{const value=JSON.parse(localStorage.getItem(key));return value??fallback}catch{return fallback}}
function save(){localStorage.setItem(inventoryKey,JSON.stringify(inventory));localStorage.setItem(bookingsKey,JSON.stringify(bookings))}
function dateFor(days){const date=new Date();date.setDate(date.getDate()+days);return date}
function dateParts(date){return {month:date.toLocaleDateString('en-US',{month:'short'}).toUpperCase(),day:date.toLocaleDateString('en-US',{day:'2-digit'}),full:date.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}}
function money(amount){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(amount)}
function eventById(id){return events.find(event=>event.id===Number(id))}
function tierById(event,id){return event.tiers.find(tier=>tier.id===Number(id))}
function available(tier){return Math.max(0,Number(inventory[tier.id]??tier.seats))}

function renderEvents(){
  const city=cityFilter.value;
  const filtered=events.filter(event=>city==='all'||event.city===city);
  eventList.innerHTML=filtered.map(event=>{
    const date=dateParts(dateFor(event.days));
    const firstTier=event.tiers.find(tier=>available(tier)>0);
    const startPrice=Math.min(...event.tiers.map(tier=>tier.price));
    return `<article class="event-card"><div class="event-cover cover-${event.category.toLowerCase()}"><div class="date-tag"><strong>${date.day}</strong>${date.month}</div></div><div class="event-info"><span class="event-category">${event.category}</span><h3>${event.title}</h3><p class="event-meta">${date.full} · ${event.city}</p><p class="event-meta">${event.venue}</p><div class="event-bottom"><span class="price">From <strong>${money(startPrice)}</strong></span><button class="button button-dark small-button" data-book="${event.id}" ${firstTier?'':'disabled'}>${firstTier?'Book tickets':'Sold out'}</button></div></div></article>`;
  }).join('')||'<div class="empty-state">No events in this city yet.</div>';
}

function renderBookings(){
  document.querySelector('#booking-count').textContent=bookings.filter(booking=>!booking.cancelled).length;
  if(!bookings.length){bookingList.innerHTML='<div class="empty-state">No bookings yet. Find an event you love and save your spot.</div>';return}
  bookingList.innerHTML=[...bookings].reverse().map(booking=>{
    const event=eventById(booking.eventId);
    if(!event)return '';
    const tier=tierById(event,booking.ticketId);
    const date=dateParts(dateFor(event.days));
    return `<article class="booking-row"><div><h3>${event.title}<span class="status-pill">${booking.cancelled?'Cancelled':'Confirmed'}</span></h3><div class="booking-details">${date.full} · ${event.city} · ${booking.quantity} × ${tier.name} · ${booking.name}</div></div><div class="booking-price">${money(tier.price*booking.quantity)}</div>${booking.cancelled?'':'<button class="cancel-button" data-cancel="'+booking.id+'" type="button">Cancel</button>'}</article>`;
  }).join('');
}

function showToast(message){const toast=document.querySelector('#toast');toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2600)}
function openBooking(eventId){
  selectedEvent=eventById(eventId);
  if(!selectedEvent)return;
  document.querySelector('#dialog-event').textContent=`${selectedEvent.title} · ${dateParts(dateFor(selectedEvent.days)).full} · ${selectedEvent.city}`;
  document.querySelector('#customer-name').value='';
  ticketSelect.innerHTML=selectedEvent.tiers.map(tier=>`<option value="${tier.id}" ${available(tier)<1?'disabled':''}>${tier.name} · ${money(tier.price)} · ${available(tier)} left</option>`).join('');
  quantityInput.value=1;
  updateTotal();
  dialog.showModal();
}
function updateTotal(){if(!selectedEvent)return;const tier=tierById(selectedEvent,ticketSelect.value);if(tier)document.querySelector('#booking-total').textContent=money(tier.price*(Number(quantityInput.value)||0));}

document.querySelectorAll('a[href="#my-bookings"]').forEach(link=>link.addEventListener('click',()=>document.querySelector('#my-bookings').scrollIntoView({behavior:'smooth'})));
[...new Set(events.map(event=>event.city))].sort().forEach(city=>cityFilter.add(new Option(city,city)));
cityFilter.addEventListener('change',renderEvents);
eventList.addEventListener('click',event=>{const button=event.target.closest('[data-book]');if(button)openBooking(button.dataset.book)});
bookingList.addEventListener('click',event=>{
  const button=event.target.closest('[data-cancel]');if(!button)return;
  const booking=bookings.find(item=>item.id===button.dataset.cancel);if(!booking||booking.cancelled)return;
  booking.cancelled=true;inventory[booking.ticketId]=Number(inventory[booking.ticketId]||0)+booking.quantity;save();renderEvents();renderBookings();showToast('Booking cancelled. Your demo ticket inventory is restored.');
});
ticketSelect.addEventListener('change',updateTotal);quantityInput.addEventListener('input',updateTotal);
document.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
document.querySelector('#booking-form').addEventListener('submit',event=>{
  event.preventDefault();
  const tier=tierById(selectedEvent,ticketSelect.value);const quantity=Number(quantityInput.value);const name=document.querySelector('#customer-name').value.trim();
  if(!name||!tier||quantity<1||quantity>8){showToast('Please check your booking details.');return}
  if(quantity>available(tier)){showToast(`Only ${available(tier)} tickets left for this type.`);return}
  inventory[tier.id]=available(tier)-quantity;
  bookings.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,8),name,eventId:selectedEvent.id,ticketId:tier.id,quantity,cancelled:false});
  save();dialog.close();renderEvents();renderBookings();showToast('Your tickets are booked. Have a great time!');
});
document.querySelector('#clear-demo').addEventListener('click',()=>{inventory={...initialInventory};bookings=[];save();renderEvents();renderBookings();showToast('Demo bookings and inventory have been reset.')});
renderEvents();renderBookings();


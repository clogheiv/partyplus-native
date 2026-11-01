// Personal photos stay in this browser until a verified host saves the party.
// IndexedDB stores binary blobs without putting large base64 strings in the
// existing durable text draft. Upload preparation also strips source metadata.
const databaseName='partyplus.web.media.v1';
const storeName='images';
const sourceLimit=20_000_000;
export const partyPhotoLimit=1_500_000;
export function validatePhotoHeader(bytes:Uint8Array,mime:string){
 const jpeg=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
 const png=bytes.slice(0,8).every((byte,index)=>byte===[137,80,78,71,13,10,26,10][index])&&bytes.length>=8;
 const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 return mime==='image/jpeg'?jpeg:mime==='image/png'?png:mime==='image/webp'?webp:false;
}
export function photoDimensions(width:number,height:number){
 if(!width||!height||width*height>48_000_000)throw Error('Choose a photo under 48 megapixels.');
 const scale=Math.min(1,1600/Math.max(width,height));
 return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}
export async function preparePartyPhoto(file:File):Promise<Blob>{
 if(file.size>sourceLimit)throw Error('Choose a photo under 20 MB.');
 if(!validatePhotoHeader(new Uint8Array(await file.slice(0,16).arrayBuffer()),file.type))throw Error('Choose a JPEG, PNG or WebP photo. Convert HEIC photos to JPEG first.');
 let image:ImageBitmap;
 try{image=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{throw Error('This photo could not be opened. Try a JPEG, PNG or WebP copy.');}
 try{
  const size=photoDimensions(image.width,image.height);
  const canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;
  const context=canvas.getContext('2d');if(!context)throw Error('This browser could not prepare the photo. Try another browser.');
  context.fillStyle='#ffffff';context.fillRect(0,0,size.width,size.height);context.drawImage(image,0,0,size.width,size.height);
  for(const quality of [.86,.76,.66,.56]){
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('The photo could not be prepared. Try another image.')),'image/jpeg',quality));
   if(blob.size<=partyPhotoLimit)return blob;
  }
  throw Error('This photo is still too large after resizing. Choose a simpler or smaller image.');
 }finally{image.close();}
}
function database():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(databaseName,1);
  request.onupgradeneeded=()=>request.result.createObjectStore(storeName,{keyPath:'key'});
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(Error('The photo draft could not be stored in this browser. Check available storage or choose gallery artwork.'));
 });
}
async function transact<T>(mode:IDBTransactionMode,action:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
 const db=await database();
 return new Promise((resolve,reject)=>{
  const transaction=db.transaction(storeName,mode);const request=action(transaction.objectStore(storeName));let result:T;
  request.onsuccess=()=>{result=request.result;};
  transaction.oncomplete=()=>{db.close();resolve(result);};
  transaction.onabort=transaction.onerror=()=>{db.close();reject(Error('The photo draft could not be saved. Check browser storage and try again.'));};
 });
}
const key=(partyId:string,imageId:string)=>partyId+':'+imageId;
export async function storeDraftPhoto(partyId:string,imageId:string,blob:Blob){await transact('readwrite',store=>store.put({key:key(partyId,imageId),blob}));}
export async function loadDraftPhoto(partyId:string,imageId:string):Promise<Blob|null>{const row=await transact('readonly',store=>store.get(key(partyId,imageId)));return row?.blob instanceof Blob?row.blob:null;}
export async function removeDraftPhoto(partyId:string,imageId:string){await transact('readwrite',store=>store.delete(key(partyId,imageId)));}

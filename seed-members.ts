import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://khhntxdmmqqjsdnlqqpo.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
  throw new Error('Set SUPABASE_SERVICE_ROLE_KEY before running this seed script.')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })

const members = [
  { full_name: "Agrey", phone_number: "+255740435912", region: "Iringa", city: "Mufindi" },
  { full_name: "Anelia mario lumwesa", phone_number: "+255760511149", region: "Iringa", city: "Mufindi" },
  { full_name: "ANORD MAHENGE", phone_number: "+255789556665", region: "DODOMA MJINI", city: "DODOMA" },
  { full_name: "Atukuzwe hildeblant mapile", phone_number: "+255710359330", region: "Dar", city: "Kigambon" },
  { full_name: "AVILA EDIGAR", phone_number: "+255752479376", region: "Iringa", city: "Ifunda" },
  { full_name: "BRIGHT MWALINGO", phone_number: "+255615281096", region: "Unknown", city: "Unknown" },
  { full_name: "Charles msokele", phone_number: "+255672309202", region: "Mufindi", city: "Iringa" },
  { full_name: "David sanga", phone_number: "+255763851381", region: "Mufindi", city: "Iringa" },
  { full_name: "Denis Titus kiduko", phone_number: "+255750581839", region: "dar-es-salaam", city: "Dar-es-salaam" },
  { full_name: "EDMESTON ISAYA MGAYA", phone_number: "+255793245983", region: "Njombe mjini", city: "Njombe" },
  { full_name: "ELIZABETH", phone_number: "0761787901", region: "mufindi", city: "IRINGA" },
  { full_name: "ELLAH ABEL CHANG'AMIKE", phone_number: "+255746338819", region: "Mafinga", city: "Iringa" },
  { full_name: "ENOCK KALINGA", phone_number: "0792801365", region: "Mufindi", city: "Iringa" },
  { full_name: "ISAYA CASIAN MSIGALA", phone_number: "+255793549915", region: "mafinga", city: "Iringa" },
  { full_name: "JOELY MTULO", phone_number: "+255748406356", region: "dodoma", city: "Dodoma" },
  { full_name: "lameck", phone_number: "+255744964771", region: "Mufindi", city: "iringa" },
  { full_name: "Lightness kwame Nyambulapi", phone_number: "+255779956283", region: "Mbeya mjini", city: "Mbeya" },
  { full_name: "manase", phone_number: "+255770351092", region: "-", city: "Iringa" },
  { full_name: "MICHAEL", phone_number: "0757921959", region: "dar", city: "DAR-ESSALAAM" },
  { full_name: "NAILA DEULE", phone_number: "0756616213", region: "unknown", city: "Dar-es-salaam" },
  { full_name: "Pauson", phone_number: "+255749763708", region: "IRINGA", city: "IRINGA" },
  { full_name: "PELIS OSCAR MWANUKE", phone_number: "+255760058639", region: "mbalali", city: "Mbeya" },
  { full_name: "PETER MIHO", phone_number: "+255752110416", region: "-", city: "Morogoro" },
  { full_name: "REINETH BONIFACE MIHO", phone_number: "+255773516422", region: "Mufindi", city: "Iringa" },
  { full_name: "SESI MALIVA", phone_number: "+255778670802", region: "Mufindi", city: "Iringa" },
  { full_name: "Tabita", phone_number: "+255757203114", region: "Mufindi", city: "Iringa" },
  { full_name: "Tamali", phone_number: "+255619800953", region: "iringa", city: "Iringa" },
  { full_name: "TONNY KINDOLE", phone_number: "+255795011291", region: "dar-es-salaam", city: "Dar-es-salaam" },
  { full_name: "Upendo alex", phone_number: "+255789408984", region: "Mheza", city: "Tanga" },
  { full_name: "Zaituni chesco", phone_number: "+255760649670", region: "iringa", city: "Iringa" },
]

async function seedMembers() {
  let updated = 0
  let errors = 0

  for (const member of members) {
    try {
      const email = `${member.phone_number}@2021familyforever.local`
      const { data: { users } } = await supabase.auth.admin.listUsers()
      const user = users.find((u: any) => u.email === email)
      if (!user) {
        console.error(`User not found for ${member.full_name}`)
        errors++
        continue
      }
      const { error: profileError } = await supabase.from('profiles').upsert({
        user_id: user.id,
        phone_number: member.phone_number,
        full_name: member.full_name,
        region: member.region,
        city: member.city,
        role: member.full_name === 'ANORD MAHENGE' ? 'ADMIN' : 'MEMBER',
        account_status: 'ACTIVE',
      })
      if (profileError) {
        console.error(`Failed to update profile for ${member.full_name}:`, profileError.message)
        errors++
      } else {
        updated++
      }
    } catch (e) {
      console.error(`Error processing ${member.full_name}:`, e)
      errors++
    }
  }
  console.log(`\nWALOMALIZA! Updated: ${updated}, Errors: ${errors}`)
}

seedMembers()

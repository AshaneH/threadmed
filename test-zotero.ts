import { ZoteroClient } from './src/main/services/zotero-client'
import { config } from 'dotenv'
config()

async function test() {
    const apiKey = process.env.VITE_ZOTERO_API_KEY || ''
    const userId = process.env.VITE_ZOTERO_USER_ID || ''
    if (!apiKey) throw new Error("Need Zotero credentials to test")

    const client = new ZoteroClient(apiKey, userId)
    // The format=keys endpoint doesn't need pagination if we just want a flat list? We have to check if it limits to 100.
    const res = await fetch(`https://api.zotero.org/users/${userId}/items?format=keys&itemType=-attachment || note&limit=1000`, {
        headers: {
            'Zotero-API-Key': apiKey,
            'Zotero-API-Version': '3'
        }
    })

    if (!res.ok) {
        console.error("Failed", await res.text())
        return
    }

    const text = await res.text()
    const keys = text.trim().split('\n').filter(Boolean)
    console.log("Got total keys:", keys.length)
    console.log("First 5:", keys.slice(0, 5))
}
test().catch(console.error)

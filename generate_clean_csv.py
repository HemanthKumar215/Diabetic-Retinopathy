import pandas as pd
import os
from tqdm import tqdm

# --- CONFIGURATION ---
# These should match the folders in your Minor_Project directory
FOLDERS = {
    "train": {"csv": "train.csv", "images": "train_images", "output": "train_clean.csv"},
    "test": {"csv": "test.csv", "images": "test_images", "output": "test_clean.csv"}
}

def clean_csv(set_type):
    config = FOLDERS[set_type]
    
    if not os.path.exists(config["csv"]):
        print(f"Error: {config['csv']} not found.")
        return

    # Load the original CSV
    df = pd.read_csv(config["csv"])
    print(f"\nProcessing {set_type} set ({len(df)} rows)...")
    
    valid_rows = []
    
    # Check every ID in the CSV against the actual folder
    for index, row in tqdm(df.iterrows(), total=len(df)):
        img_id = str(row['id_code'])
        
        # Check for both .png and .jpg
        found = False
        for ext in ['.png', '.jpg', '.jpeg']:
            if os.path.exists(os.path.join(config["images"], img_id + ext)):
                found = True
                break
        
        if found:
            valid_rows.append(row)
            
    # Create the new cleaned DataFrame
    clean_df = pd.DataFrame(valid_rows)
    
    # Save it
    clean_df.to_csv(config["output"], index=False)
    print(f"DONE! Saved {len(clean_df)} valid entries to {config['output']}")
    print(f"Removed {len(df) - len(clean_df)} entries that were missing images.")

if __name__ == "__main__":
    clean_csv("train")
    clean_csv("test")